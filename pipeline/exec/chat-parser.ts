import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_CONFIG } from "../config.js";
import type { CanonicalMessage, Participant } from "../schemas.js";
import {
  countEmoji,
  getWordCount,
  hasUrl,
  normalizeText,
  normalizeWhitespace,
} from "../lib/text.js";

type ParsedEntry = {
  sourceLineStart: number;
  sourceLineEnd: number;
  timestampRaw: string;
  senderLabel: string | null;
  text: string;
  messageType: CanonicalMessage["message_type"];
};

const TRANSCRIPT_LINE_PATTERN =
  /^(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2})\s*(?:\u202f|\u00a0|\s)?(am|pm)\s+-\s+(.*)$/iu;

function parseTimestamp(timestampRaw: string): Date {
  const [datePart, timePart] = timestampRaw.split(", ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [time, meridiem] = timePart.split(" ");
  const [hourRaw, minute] = time.split(":").map(Number);
  const meridiemLower = meridiem.toLowerCase();
  const normalizedHour =
    meridiemLower === "pm" && hourRaw !== 12
      ? hourRaw + 12
      : meridiemLower === "am" && hourRaw === 12
        ? 0
        : hourRaw;

  return new Date(year, month - 1, day, normalizedHour, minute, 0, 0);
}

function toLocalIso(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hour = `${value.getHours()}`.padStart(2, "0");
  const minute = `${value.getMinutes()}`.padStart(2, "0");
  const second = `${value.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function detectMessageType(
  senderLabel: string | null,
  text: string,
): CanonicalMessage["message_type"] {
  if (!senderLabel) {
    return "system";
  }

  if (text === "<Media omitted>") {
    return "media_omitted";
  }

  if (/message was deleted/iu.test(text)) {
    return "deleted";
  }

  return "text";
}

function buildTechnicalSessionIds(
  messages: Omit<CanonicalMessage, "technical_session_id" | "reply_gap_minutes">[],
): CanonicalMessage[] {
  let sessionIndex = 0;
  let previous: Omit<CanonicalMessage, "technical_session_id" | "reply_gap_minutes"> | undefined;
  const previousByParticipant = new Map<string, Date>();

  return messages.map((message) => {
    const currentDate = new Date(message.timestamp_local);
    const previousDate = previous ? new Date(previous.timestamp_local) : undefined;
    const gapMinutes =
      previousDate ? Math.max(0, Math.round((currentDate.getTime() - previousDate.getTime()) / 60000)) : null;

    if (!previous || (gapMinutes ?? 0) >= PROJECT_CONFIG.technicalSessionGapMinutes) {
      sessionIndex += 1;
    }

    const participantGap =
      message.sender_id && previousByParticipant.has(message.sender_id)
        ? Math.max(
            0,
            Math.round(
              (currentDate.getTime() - previousByParticipant.get(message.sender_id)!.getTime()) / 60000,
            ),
          )
        : null;

    if (message.sender_id) {
      previousByParticipant.set(message.sender_id, currentDate);
    }

    previous = message;

    return {
      ...message,
      technical_session_id: `tech_${String(sessionIndex).padStart(4, "0")}`,
      reply_gap_minutes: participantGap,
    };
  });
}

function finalizeEntry(entry: ParsedEntry): ParsedEntry {
  const text = normalizeWhitespace(entry.text);
  return {
    ...entry,
    text,
    messageType: detectMessageType(entry.senderLabel, text),
  };
}

export async function parseWhatsAppTranscript(
  filePath: string,
): Promise<{ messages: CanonicalMessage[]; participants: Participant[] }> {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const entries: ParsedEntry[] = [];
  let current: ParsedEntry | undefined;

  lines.forEach((line, lineIndex) => {
    const match = line.match(TRANSCRIPT_LINE_PATTERN);

    if (match) {
      if (current) {
        entries.push(finalizeEntry(current));
      }

      const [, datePart, timePart, meridiem, rest] = match;
      const rawTimestamp = `${datePart}, ${timePart} ${meridiem.toLowerCase()}`;
      const separatorIndex = rest.indexOf(": ");
      const hasSender = separatorIndex > 0;
      const senderLabel = hasSender ? rest.slice(0, separatorIndex) : null;
      const text = hasSender ? rest.slice(separatorIndex + 2) : rest;

      current = {
        sourceLineStart: lineIndex + 1,
        sourceLineEnd: lineIndex + 1,
        timestampRaw: rawTimestamp,
        senderLabel,
        text,
        messageType: "text",
      };
      return;
    }

    if (current) {
      current.text = `${current.text}\n${line}`;
      current.sourceLineEnd = lineIndex + 1;
    }
  });

  if (current) {
    entries.push(finalizeEntry(current));
  }

  const senderCounts = new Map<string, number>();
  const senderFirstMessageId = new Map<string, string>();
  const discoveredSenderOrder: string[] = [];

  const preliminary = entries.map((entry, index) => {
    if (entry.senderLabel && !senderCounts.has(entry.senderLabel)) {
      discoveredSenderOrder.push(entry.senderLabel);
      senderCounts.set(entry.senderLabel, 0);
    }

    if (entry.senderLabel) {
      senderCounts.set(entry.senderLabel, (senderCounts.get(entry.senderLabel) ?? 0) + 1);
    }

    return { entry, index };
  });

  const participantMap = new Map<string, string>();
  discoveredSenderOrder.forEach((senderLabel, index) => {
    participantMap.set(senderLabel, `participant_${String(index + 1).padStart(2, "0")}`);
  });

  const canonicalSeed = preliminary.map(({ entry, index }) => {
    const timestamp = parseTimestamp(entry.timestampRaw);
    const timestampLocal = toLocalIso(timestamp);
    const senderId = entry.senderLabel ? participantMap.get(entry.senderLabel)! : null;
    const messageId = `msg_${String(index + 1).padStart(7, "0")}`;

    if (entry.senderLabel && !senderFirstMessageId.has(entry.senderLabel)) {
      senderFirstMessageId.set(entry.senderLabel, messageId);
    }

    return {
      message_id: messageId,
      source_file: path.basename(filePath),
      source_line_start: entry.sourceLineStart,
      source_line_end: entry.sourceLineEnd,
      timestamp_raw: entry.timestampRaw,
      timestamp_local: timestampLocal,
      timezone_assumed: PROJECT_CONFIG.timezone,
      sender_id: senderId,
      sender_label: entry.senderLabel,
      message_type: entry.messageType,
      text: entry.text,
      normalized_text: normalizeText(entry.text),
      has_url: hasUrl(entry.text),
      char_count: entry.text.length,
      word_count: getWordCount(entry.text),
      emoji_count: countEmoji(entry.text),
      is_multiline: entry.sourceLineEnd > entry.sourceLineStart,
      hour_of_day: timestamp.getHours(),
      weekday: timestamp.getDay(),
      day_key: timestampLocal.slice(0, 10),
      week_key: "",
      month_key: `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  canonicalSeed.forEach((message) => {
    const date = new Date(message.timestamp_local);
    const startOfWeek = new Date(date);
    const delta = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - delta);
    message.week_key = toLocalIso(startOfWeek).slice(0, 10);
  });

  const messages = buildTechnicalSessionIds(canonicalSeed);
  const participants: Participant[] = discoveredSenderOrder.map((label) => ({
    participant_id: participantMap.get(label)!,
    label,
    message_count: senderCounts.get(label) ?? 0,
    first_message_id: senderFirstMessageId.get(label) ?? null,
  }));

  return { messages, participants };
}
