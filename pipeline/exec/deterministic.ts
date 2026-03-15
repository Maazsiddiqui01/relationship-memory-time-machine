import { differenceInCalendarDays } from "date-fns";

import { PROJECT_CONFIG, type ArchetypeLabel, type EmotionLabel } from "../config.js";
import type {
  CanonicalMessage,
  ChapterSegment,
  DashboardInsights,
  EmotionTimelinePoint,
  MessageAnnotation,
  MessageFrequency,
  NarrativeSegment,
  Participant,
  PhraseMotif,
  SignatureMetrics,
  TechnicalSessionSummary,
} from "../schemas.js";
import { groupBy } from "../lib/io.js";
import { formatCompactNumber, sentenceCase, titleCase, tokenize } from "../lib/text.js";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function roundTo(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function createParticipantCounts(participants: Participant[]): Record<string, number> {
  return Object.fromEntries(
    participants.map((participant) => [participant.participant_id, 0]),
  );
}

function sortCountMap<T extends string>(value: Map<T, number>, limit?: number) {
  const entries = [...value.entries()].sort((left, right) => right[1] - left[1]);
  return typeof limit === "number" ? entries.slice(0, limit) : entries;
}

function getDominantLabel<T extends string>(entries: T[], fallback: T): T {
  if (!entries.length) {
    return fallback;
  }

  const counts = new Map<T, number>();
  for (const entry of entries) {
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function getTopLabels<T extends string>(entries: T[], limit = 3): T[] {
  const counts = new Map<T, number>();
  for (const entry of entries) {
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label]) => label);
}

export function buildTechnicalSessionSummaries(
  messages: CanonicalMessage[],
  annotations: Map<string, MessageAnnotation>,
): TechnicalSessionSummary[] {
  const sessionGroups = groupBy(messages, (message) => message.technical_session_id);

  return [...sessionGroups.entries()].map(([technicalSessionId, sessionMessages]) => {
    const sessionAnnotations = sessionMessages
      .map((message) => annotations.get(message.message_id))
      .filter((annotation): annotation is MessageAnnotation => Boolean(annotation));
    const start = sessionMessages[0];
    const end = sessionMessages.at(-1)!;
    const participantMessageCounts = Object.fromEntries(
      [...groupBy(sessionMessages.filter((message) => message.sender_id), (message) => message.sender_id!)]
        .map(([participantId, participantMessages]) => [participantId, participantMessages.length]),
    );

    return {
      technical_session_id: technicalSessionId,
      start_message_id: start.message_id,
      end_message_id: end.message_id,
      start_timestamp: start.timestamp_local,
      end_timestamp: end.timestamp_local,
      message_count: sessionMessages.length,
      participant_message_counts: participantMessageCounts,
      dominant_emotion: getDominantLabel(
        sessionAnnotations.map((annotation) => annotation.emotion_label),
        "neutral",
      ),
      dominant_topics: getTopLabels(sessionAnnotations.flatMap((annotation) => annotation.topic_tags), 3),
      dominant_archetypes: getTopLabels(
        sessionAnnotations.flatMap((annotation) => annotation.archetype_tags),
        3,
      ),
      average_importance:
        sessionAnnotations.reduce((sum, annotation) => sum + annotation.importance_score, 0) /
        Math.max(sessionAnnotations.length, 1),
      density_score:
        sessionMessages.length /
        Math.max(
          1,
          (new Date(end.timestamp_local).getTime() - new Date(start.timestamp_local).getTime()) / 3600000,
        ),
      highlight_message_ids: sessionAnnotations
        .filter((annotation) => annotation.highlight_candidate)
        .sort((left, right) => right.importance_score - left.importance_score)
        .slice(0, 5)
        .map((annotation) => annotation.message_id),
    };
  });
}

function getNarrativeChangeScore(
  previous: TechnicalSessionSummary | undefined,
  current: TechnicalSessionSummary,
): number {
  if (!previous) {
    return 2;
  }

  let score = 0;
  const gapDays = differenceInCalendarDays(
    new Date(current.start_timestamp),
    new Date(previous.end_timestamp),
  );
  if (gapDays >= 2) {
    score += 2;
  }
  if (previous.dominant_emotion !== current.dominant_emotion) {
    score += 1;
  }
  if (!previous.dominant_topics.some((topic) => current.dominant_topics.includes(topic))) {
    score += 1;
  }
  if (Math.abs(previous.density_score - current.density_score) >= 4) {
    score += 1;
  }
  if (
    previous.dominant_archetypes.includes("conflict") &&
    current.dominant_archetypes.includes("repair_reconnection")
  ) {
    score += 2;
  }

  return score;
}

function buildNarrativeSegmentTitle(index: number, segment: NarrativeSegment): string {
  const dominantArchetype = segment.dominant_archetypes[0];
  const titlesByArchetype: Record<string, string[]> = {
    affection: ["Closer Orbit", "Warmth in Motion", "Tender Gravity"],
    planning: ["Plans Taking Shape", "Maps and Maybe", "Shared Trajectory"],
    humor_banter: ["Laughter Loops", "Playful Momentum", "Banter Season"],
    reassurance: ["Holding Steady", "Quiet Support", "Soft Landing"],
    conflict: ["Friction Lines", "Tension in Motion", "The Harder Edge"],
    repair_reconnection: ["Finding the Way Back", "Mending the Thread", "Returning Warmth"],
    longing_missing: ["Distance and Pull", "Missing Each Other", "Far but Present"],
    future_imagining: ["Looking Ahead", "What If Us", "Future Shape"],
    "check-in": ["Daily Signals", "Checking In", "Small Openings"],
    everyday_life: ["Everyday Gravity", "Ordinary Days, Real Closeness", "Shared Routine"],
  };

  const choices = titlesByArchetype[dominantArchetype] ?? ["A New Chapter", "Another Turning", "Shared Time"];
  return choices[index % choices.length];
}

export function buildNarrativeSegments(
  technicalSessions: TechnicalSessionSummary[],
  messageLookup: Map<string, CanonicalMessage>,
): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  let currentBucket: TechnicalSessionSummary[] = [];

  const flush = (): void => {
    if (!currentBucket.length) {
      return;
    }

    const start = currentBucket[0];
    const end = currentBucket.at(-1)!;
    const segmentIndex = segments.length + 1;
    const dominantEmotion = getDominantLabel(
      currentBucket.map((session) => session.dominant_emotion),
      "neutral",
    );
    const dominantTopics = getTopLabels(currentBucket.flatMap((session) => session.dominant_topics), 3);
    const dominantArchetypes = getTopLabels(
      currentBucket.flatMap((session) => session.dominant_archetypes),
      3,
    );
    const highlightMessageIds = currentBucket.flatMap((session) => session.highlight_message_ids).slice(0, 8);
    const firstHighlight = highlightMessageIds[0];
    const quote = firstHighlight ? messageLookup.get(firstHighlight)?.text ?? "" : "";
    const narrativeSegment: NarrativeSegment = {
      narrative_segment_id: `segment_${String(segmentIndex).padStart(4, "0")}`,
      title: "",
      summary: `${sentenceCase(dominantEmotion)} energy with ${titleCase(
        dominantArchetypes[0] ?? "everyday_life",
      )} moments and ${titleCase(dominantTopics[0] ?? "daily_life")} themes.${
        quote ? ` Representative line: "${quote.slice(0, 120)}"` : ""
      }`,
      start_message_id: start.start_message_id,
      end_message_id: end.end_message_id,
      start_timestamp: start.start_timestamp,
      end_timestamp: end.end_timestamp,
      message_count: currentBucket.reduce((sum, session) => sum + session.message_count, 0),
      technical_session_ids: currentBucket.map((session) => session.technical_session_id),
      dominant_emotion: dominantEmotion,
      dominant_topics: dominantTopics.length ? dominantTopics : ["daily_life"],
      dominant_archetypes: dominantArchetypes.length ? dominantArchetypes : ["everyday_life"],
      turning_point:
        dominantArchetypes.includes("repair_reconnection") ||
        dominantArchetypes.includes("future_imagining") ||
        dominantEmotion === "conflict",
      conflict_repair_cycle:
        currentBucket.some((session) => session.dominant_archetypes.includes("conflict")) &&
        currentBucket.some((session) => session.dominant_archetypes.includes("repair_reconnection")),
      highlight_message_ids: highlightMessageIds,
    };
    narrativeSegment.title = buildNarrativeSegmentTitle(segmentIndex - 1, narrativeSegment);
    segments.push(narrativeSegment);
  };

  technicalSessions.forEach((session, index) => {
    const previous = currentBucket.at(-1);
    const shouldBreak =
      currentBucket.length >= 4 || getNarrativeChangeScore(previous, session) >= 2 || index === 0;

    if (shouldBreak && currentBucket.length) {
      flush();
      currentBucket = [];
    }

    currentBucket.push(session);
  });

  flush();
  return segments;
}

export function buildPhraseMotifCandidates(messages: CanonicalMessage[]): PhraseMotif[] {
  const candidates = new Map<string, { count: number; messageIds: string[] }>();

  for (const message of messages) {
    if (message.message_type !== "text") {
      continue;
    }
    if (message.word_count < 2 || message.word_count > 8) {
      continue;
    }

    const tokens = tokenize(message.text);
    if (tokens.length < 2 || tokens.length > 8) {
      continue;
    }

    const normalizedPhrase = tokens.join(" ");
    const current = candidates.get(normalizedPhrase) ?? { count: 0, messageIds: [] };
    current.count += 1;
    current.messageIds.push(message.message_id);
    candidates.set(normalizedPhrase, current);
  }

  return [...candidates.entries()]
    .filter(([, candidate]) => candidate.count >= 3)
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 40)
    .map(([normalizedPhrase, candidate], index) => ({
      motif_id: `motif_${String(index + 1).padStart(4, "0")}`,
      label: sentenceCase(normalizedPhrase),
      normalized_phrase: normalizedPhrase,
      count: candidate.count,
      representative_message_ids: candidate.messageIds.slice(0, 8),
      archetype_hint: null,
    }));
}

export function buildMessageFrequency(messages: CanonicalMessage[]): MessageFrequency {
  const dailyGroups = groupBy(
    messages.filter((message) => message.message_type !== "system"),
    (message) => message.day_key,
  );
  const heatmapGroups = groupBy(messages, (message) => `${message.weekday}:${message.hour_of_day}`);
  const dailyCounts = [...dailyGroups.entries()]
    .map(([dayKey, dayMessages]) => ({
      day_key: dayKey,
      count: dayMessages.length,
    }))
    .sort((left, right) => left.day_key.localeCompare(right.day_key));

  const summary = {
    total_messages: messages.length,
    active_days: dailyCounts.length,
    average_daily_messages:
      dailyCounts.reduce((sum, day) => sum + day.count, 0) / Math.max(dailyCounts.length, 1),
  };

  const heatmapBins = [...heatmapGroups.entries()].map(([key, binMessages]) => {
    const [weekday, hourOfDay] = key.split(":").map(Number);
    return {
      weekday,
      hour_of_day: hourOfDay,
      count: binMessages.length,
    };
  });

  return { summary, daily_counts: dailyCounts, heatmap_bins: heatmapBins };
}

export function buildEmotionTimeline(
  messages: CanonicalMessage[],
  annotations: Map<string, MessageAnnotation>,
): EmotionTimelinePoint[] {
  const weekGroups = groupBy(
    messages.filter((message) => message.message_type !== "system"),
    (message) => message.week_key,
  );
  return [...weekGroups.entries()]
    .map(([weekKey, weekMessages]) => {
      const weekAnnotations = weekMessages
        .map((message) => annotations.get(message.message_id))
        .filter((annotation): annotation is MessageAnnotation => Boolean(annotation));
      return {
        period_start: weekKey,
        period_label: weekKey,
        average_intensity:
          weekAnnotations.reduce((sum, annotation) => sum + annotation.emotion_intensity, 0) /
          Math.max(weekAnnotations.length, 1),
        dominant_emotion: getDominantLabel(
          weekAnnotations.map((annotation) => annotation.emotion_label),
          "neutral",
        ),
        message_count: weekMessages.length,
      };
    })
    .sort((left, right) => left.period_start.localeCompare(right.period_start));
}

function calculateLongestStreak(dayKeys: string[]): number {
  if (!dayKeys.length) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = new Date(dayKeys[index - 1]);
    const currentDate = new Date(dayKeys[index]);
    const delta = differenceInCalendarDays(currentDate, previous);
    if (delta === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function buildSignatureMetrics(params: {
  messages: CanonicalMessage[];
  participants: Participant[];
  annotations: Map<string, MessageAnnotation>;
  technicalSessions: TechnicalSessionSummary[];
  chapters: ChapterSegment[];
}): SignatureMetrics {
  const { messages, participants, annotations, technicalSessions, chapters } = params;
  const activeMessages = messages.filter((message) => message.message_type !== "system");
  const frequency = buildMessageFrequency(activeMessages);
  const dayKeys = frequency.daily_counts.map((day) => day.day_key);
  const monthGroups = groupBy(activeMessages, (message) => message.month_key);
  const mostActiveMonth = [...monthGroups.entries()]
    .map(([monthKey, monthMessages]) => ({
      month_key: monthKey,
      count: monthMessages.length,
    }))
    .sort((left, right) => right.count - left.count)[0];
  const longestTechnicalSession = [...technicalSessions].sort(
    (left, right) => right.message_count - left.message_count,
  )[0];
  const lateNightCount = activeMessages.filter((message) =>
    PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day),
  ).length;
  const supportMomentsCount = [...annotations.values()].filter((annotation) => annotation.support_signal).length;

  const conflictRepairCycles = technicalSessions.reduce((count, session, index) => {
    if (index === 0) {
      return count;
    }
    const previous = technicalSessions[index - 1];
    if (
      previous.dominant_archetypes.includes("conflict") &&
      session.dominant_archetypes.includes("repair_reconnection")
    ) {
      return count + 1;
    }
    return count;
  }, 0);

  return {
    generated_at: new Date().toISOString(),
    headline: {
      total_messages: activeMessages.length,
      average_daily_messages: Number(frequency.summary.average_daily_messages.toFixed(2)),
      longest_daily_streak: calculateLongestStreak(dayKeys),
      most_active_day: [...frequency.daily_counts].sort((left, right) => right.count - left.count)[0] ?? {
        day_key: "",
        count: 0,
      },
      most_active_month: mostActiveMonth ?? {
        month_key: "",
        count: 0,
      },
      longest_technical_session: {
        technical_session_id: longestTechnicalSession?.technical_session_id ?? "",
        message_count: longestTechnicalSession?.message_count ?? 0,
      },
      late_night_percentage: Number(
        ((lateNightCount / Math.max(activeMessages.length, 1)) * 100).toFixed(2),
      ),
      support_moments_count: supportMomentsCount,
      conflict_repair_cycles: conflictRepairCycles,
    },
    participant_reply_gaps: participants.map((participant) => {
      const participantMessages = activeMessages.filter(
        (message) => message.sender_id === participant.participant_id && message.reply_gap_minutes !== null,
      );
      const average =
        participantMessages.reduce((sum, message) => sum + (message.reply_gap_minutes ?? 0), 0) /
        Math.max(participantMessages.length, 1);
      return {
        participant_id: participant.participant_id,
        label: participant.label,
        average_reply_gap_minutes: Number(average.toFixed(2)),
      };
    }),
    chapter_tones: chapters.map((chapter) => ({
      chapter_id: chapter.chapter_id,
      title: chapter.title,
      dominant_emotion: chapter.dominant_emotion,
    })),
    story_spotlights: [
      {
        label: "Messages shared",
        value: formatCompactNumber(activeMessages.length),
        supporting_message_ids: activeMessages.slice(0, 3).map((message) => message.message_id),
      },
      {
        label: "Longest streak",
        value: `${calculateLongestStreak(dayKeys)} days`,
        supporting_message_ids: activeMessages.slice(0, 3).map((message) => message.message_id),
      },
      {
        label: "Most active month",
        value: mostActiveMonth
          ? `${mostActiveMonth.month_key} (${formatCompactNumber(mostActiveMonth.count)})`
          : "N/A",
        supporting_message_ids: activeMessages
          .filter((message) => message.month_key === mostActiveMonth?.month_key)
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        label: "Late-night share",
        value: `${Number(((lateNightCount / Math.max(activeMessages.length, 1)) * 100).toFixed(1))}%`,
        supporting_message_ids: activeMessages
          .filter((message) => PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day))
          .slice(0, 3)
          .map((message) => message.message_id),
      },
    ],
  };
}

export function buildDashboardInsights(params: {
  messages: CanonicalMessage[];
  participants: Participant[];
  annotations: Map<string, MessageAnnotation>;
  technicalSessions: TechnicalSessionSummary[];
  chapters: ChapterSegment[];
}): DashboardInsights {
  const { messages, participants, annotations, technicalSessions, chapters } = params;
  const activeMessages = messages.filter((message) => message.message_type !== "system");
  const totalMessages = activeMessages.length;
  const totalEmojiCount = activeMessages.reduce((sum, message) => sum + message.emoji_count, 0);
  const totalLinkCount = activeMessages.reduce((sum, message) => sum + (message.has_url ? 1 : 0), 0);
  const totalMultilineCount = activeMessages.reduce(
    (sum, message) => sum + (message.is_multiline ? 1 : 0),
    0,
  );
  const sessionGroups = groupBy(activeMessages, (message) => message.technical_session_id);
  const totalSessionCount = sessionGroups.size;
  const monthGroups = groupBy(activeMessages, (message) => message.month_key);
  const weekGroups = groupBy(activeMessages, (message) => message.week_key);
  const timeWindowCounts = new Map<string, number>();

  const participantStats = new Map(
    participants.map((participant) => [
      participant.participant_id,
      {
        participant_id: participant.participant_id,
        label: participant.label,
        total_messages: 0,
        total_words: 0,
        total_chars: 0,
        emoji_count: 0,
        link_count: 0,
        multiline_count: 0,
        weekend_count: 0,
        late_night_count: 0,
        session_opener_count: 0,
        longest_message_length: 0,
        reply_gap_sum: 0,
        reply_gap_count: 0,
      },
    ]),
  );
  const participantWindowCounts = new Map(
    participants.map((participant) => [participant.participant_id, new Map<string, number>()]),
  );
  const participantHourCounts = new Map(
    participants.map((participant) => [participant.participant_id, new Map<number, number>()]),
  );
  const participantWeekdayCounts = new Map(
    participants.map((participant) => [participant.participant_id, new Map<number, number>()]),
  );

  const weekdayDistribution = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    total_messages: 0,
    participant_counts: createParticipantCounts(participants),
  }));
  const hourDistribution = Array.from({ length: 24 }, (_, hourOfDay) => ({
    hour_of_day: hourOfDay,
    label: `${String(hourOfDay).padStart(2, "0")}:00`,
    total_messages: 0,
    participant_counts: createParticipantCounts(participants),
  }));

  const emotionCounts = new Map<string, number>();
  const archetypeCounts = new Map<string, number>();
  const participantEmotionCounts = new Map(
    participants.map((participant) => [participant.participant_id, new Map<string, number>()]),
  );
  const participantArchetypeCounts = new Map(
    participants.map((participant) => [participant.participant_id, new Map<string, number>()]),
  );
  const participantSignalCounts = new Map(
    participants.map((participant) => [
      participant.participant_id,
      {
        support_count: 0,
        conflict_count: 0,
        repair_count: 0,
      },
    ]),
  );
  const signalTrend = new Map<
    string,
    {
      support_count: number;
      conflict_count: number;
      repair_count: number;
    }
  >();

  for (const sessionMessages of sessionGroups.values()) {
    const firstMessage = sessionMessages[0];
    if (!firstMessage?.sender_id) {
      continue;
    }
    const participant = participantStats.get(firstMessage.sender_id);
    if (participant) {
      participant.session_opener_count += 1;
    }
  }

  for (const message of activeMessages) {
    const isWeekend = message.weekday === 0 || message.weekday === 6;
    if (message.sender_id) {
      const participant = participantStats.get(message.sender_id);
      if (participant) {
        participant.total_messages += 1;
        participant.total_words += message.word_count;
        participant.total_chars += message.char_count;
        participant.emoji_count += message.emoji_count;
        participant.link_count += message.has_url ? 1 : 0;
        participant.multiline_count += message.is_multiline ? 1 : 0;
        participant.weekend_count += isWeekend ? 1 : 0;
        participant.late_night_count += PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day) ? 1 : 0;
        participant.longest_message_length = Math.max(participant.longest_message_length, message.char_count);
        if (message.reply_gap_minutes !== null) {
          participant.reply_gap_sum += message.reply_gap_minutes;
          participant.reply_gap_count += 1;
        }
      }
    }

    weekdayDistribution[message.weekday].total_messages += 1;
    hourDistribution[message.hour_of_day].total_messages += 1;
    const windowKey = `${message.weekday}:${message.hour_of_day}`;
    timeWindowCounts.set(windowKey, (timeWindowCounts.get(windowKey) ?? 0) + 1);
    if (message.sender_id) {
      weekdayDistribution[message.weekday].participant_counts[message.sender_id] += 1;
      hourDistribution[message.hour_of_day].participant_counts[message.sender_id] += 1;
      const participantWindows = participantWindowCounts.get(message.sender_id);
      if (participantWindows) {
        participantWindows.set(windowKey, (participantWindows.get(windowKey) ?? 0) + 1);
      }
      const participantHours = participantHourCounts.get(message.sender_id);
      if (participantHours) {
        participantHours.set(message.hour_of_day, (participantHours.get(message.hour_of_day) ?? 0) + 1);
      }
      const participantWeekdays = participantWeekdayCounts.get(message.sender_id);
      if (participantWeekdays) {
        participantWeekdays.set(message.weekday, (participantWeekdays.get(message.weekday) ?? 0) + 1);
      }
    }

    const annotation = annotations.get(message.message_id);
    if (!annotation) {
      continue;
    }

    emotionCounts.set(annotation.emotion_label, (emotionCounts.get(annotation.emotion_label) ?? 0) + 1);
    const monthSignal = signalTrend.get(message.month_key) ?? {
      support_count: 0,
      conflict_count: 0,
      repair_count: 0,
    };
    if (annotation.support_signal) {
      monthSignal.support_count += 1;
      if (message.sender_id) {
        const participantSignal = participantSignalCounts.get(message.sender_id);
        if (participantSignal) {
          participantSignal.support_count += 1;
        }
      }
    }
    if (annotation.conflict_signal) {
      monthSignal.conflict_count += 1;
      if (message.sender_id) {
        const participantSignal = participantSignalCounts.get(message.sender_id);
        if (participantSignal) {
          participantSignal.conflict_count += 1;
        }
      }
    }
    if (annotation.repair_signal) {
      monthSignal.repair_count += 1;
      if (message.sender_id) {
        const participantSignal = participantSignalCounts.get(message.sender_id);
        if (participantSignal) {
          participantSignal.repair_count += 1;
        }
      }
    }
    signalTrend.set(message.month_key, monthSignal);

    for (const archetype of annotation.archetype_tags) {
      archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
      if (message.sender_id) {
        const participantArchetypes = participantArchetypeCounts.get(message.sender_id);
        if (participantArchetypes) {
          participantArchetypes.set(archetype, (participantArchetypes.get(archetype) ?? 0) + 1);
        }
      }
    }

    if (message.sender_id) {
      const participantEmotions = participantEmotionCounts.get(message.sender_id);
      if (participantEmotions) {
        participantEmotions.set(
          annotation.emotion_label,
          (participantEmotions.get(annotation.emotion_label) ?? 0) + 1,
        );
      }
    }
  }

  const participantOverview = participants.map((participant) => {
    const stats = participantStats.get(participant.participant_id);
    const totalParticipantMessages = stats?.total_messages ?? 0;
    const replyGapAverage =
      stats && stats.reply_gap_count > 0 ? stats.reply_gap_sum / stats.reply_gap_count : 0;

    return {
      participant_id: participant.participant_id,
      label: participant.label,
      total_messages: totalParticipantMessages,
      message_share: roundTo((totalParticipantMessages / Math.max(totalMessages, 1)) * 100),
      total_words: stats?.total_words ?? 0,
      average_words_per_message: roundTo(
        (stats?.total_words ?? 0) / Math.max(totalParticipantMessages, 1),
      ),
      average_chars_per_message: roundTo(
        (stats?.total_chars ?? 0) / Math.max(totalParticipantMessages, 1),
      ),
      emoji_count: stats?.emoji_count ?? 0,
      emoji_share: roundTo(((stats?.emoji_count ?? 0) / Math.max(totalEmojiCount, 1)) * 100),
      emoji_per_message: roundTo((stats?.emoji_count ?? 0) / Math.max(totalParticipantMessages, 1)),
      link_count: stats?.link_count ?? 0,
      link_share: roundTo(((stats?.link_count ?? 0) / Math.max(totalLinkCount, 1)) * 100),
      multiline_count: stats?.multiline_count ?? 0,
      multiline_share: roundTo(
        ((stats?.multiline_count ?? 0) / Math.max(totalMultilineCount, 1)) * 100,
      ),
      weekend_percentage: roundTo(
        ((stats?.weekend_count ?? 0) / Math.max(totalParticipantMessages, 1)) * 100,
      ),
      late_night_percentage: roundTo(
        ((stats?.late_night_count ?? 0) / Math.max(totalParticipantMessages, 1)) * 100,
      ),
      session_opener_count: stats?.session_opener_count ?? 0,
      session_opener_share: roundTo(
        ((stats?.session_opener_count ?? 0) / Math.max(totalSessionCount, 1)) * 100,
      ),
      longest_message_length: stats?.longest_message_length ?? 0,
      average_reply_gap_minutes: roundTo(replyGapAverage),
    };
  });

  const monthlySplit = [...monthGroups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([monthKey, monthMessages]) => {
      const participantCounts = createParticipantCounts(participants);
      let lateNightCount = 0;
      for (const message of monthMessages) {
        if (message.sender_id) {
          participantCounts[message.sender_id] += 1;
        }
        if (PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day)) {
          lateNightCount += 1;
        }
      }

      return {
        month_key: monthKey,
        total_messages: monthMessages.length,
        participant_counts: participantCounts,
        late_night_count: lateNightCount,
      };
    });

  const lateNightTrend = monthlySplit.map((month) => {
    const monthMessages = monthGroups.get(month.month_key) ?? [];
    const participantCounts = createParticipantCounts(participants);
    let lateNightMessages = 0;

    for (const message of monthMessages) {
      if (!PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day)) {
        continue;
      }
      lateNightMessages += 1;
      if (message.sender_id) {
        participantCounts[message.sender_id] += 1;
      }
    }

    return {
      month_key: month.month_key,
      total_messages: month.total_messages,
      late_night_messages: lateNightMessages,
      late_night_share: roundTo((lateNightMessages / Math.max(month.total_messages, 1)) * 100),
      participant_counts: participantCounts,
    };
  });

  const monthWinners = monthlySplit.map((month) => {
    const ranking = participants
      .map((participant) => ({
        participant_id: participant.participant_id,
        label: participant.label,
        count: month.participant_counts[participant.participant_id] ?? 0,
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
    const winner = ranking[0];
    const runnerUp = ranking[1];
    const tied = (winner?.count ?? 0) === (runnerUp?.count ?? -1);

    return {
      month_key: month.month_key,
      winner_participant_id: tied ? null : winner?.participant_id ?? null,
      winner_label: tied ? null : winner?.label ?? null,
      winner_count: winner?.count ?? 0,
      margin: tied ? 0 : Math.max(0, (winner?.count ?? 0) - (runnerUp?.count ?? 0)),
      total_messages: month.total_messages,
    };
  });

  const participantPeakWindows = participants.map((participant) => {
    const windowCounts = participantWindowCounts.get(participant.participant_id) ?? new Map<string, number>();
    const weekdayCounts = participantWeekdayCounts.get(participant.participant_id) ?? new Map<number, number>();
    const hourCounts = participantHourCounts.get(participant.participant_id) ?? new Map<number, number>();

    return {
      participant_id: participant.participant_id,
      label: participant.label,
      top_windows: [...windowCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 4)
        .map(([key, count]) => {
          const [weekday, hourOfDay] = key.split(":").map(Number);
          return {
            label: `${WEEKDAY_LABELS[weekday] ?? "?"} ${String(hourOfDay).padStart(2, "0")}:00`,
            weekday,
            hour_of_day: hourOfDay,
            count,
          };
        }),
      top_weekdays: [...weekdayCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0] - right[0])
        .slice(0, 3)
        .map(([weekday, count]) => ({
          label: WEEKDAY_LABELS[weekday] ?? "?",
          count,
        })),
      top_hours: [...hourCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0] - right[0])
        .slice(0, 3)
        .map(([hourOfDay, count]) => ({
          label: `${String(hourOfDay).padStart(2, "0")}:00`,
          count,
        })),
    };
  });

  const hourWindowCounts = weekdayDistribution.flatMap((weekday) =>
    Array.from({ length: 24 }, (_, hourOfDay) => {
      const count = timeWindowCounts.get(`${weekday.weekday}:${hourOfDay}`) ?? 0;
      return {
        label: `${weekday.label} ${String(hourOfDay).padStart(2, "0")}:00`,
        weekday: weekday.weekday,
        hour_of_day: hourOfDay,
        count,
      };
    }),
  );

  const highestVolumeDays = buildMessageFrequency(activeMessages).daily_counts
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
    .map((day) => ({
      day_key: day.day_key,
      count: day.count,
    }));

  const silenceGaps = activeMessages
    .slice(1)
    .map((message, index) => {
      const previous = activeMessages[index];
      const gapMinutes =
        (new Date(message.timestamp_local).getTime() - new Date(previous.timestamp_local).getTime()) / 60000;
      return {
        from_message_id: previous.message_id,
        to_message_id: message.message_id,
        start_timestamp: previous.timestamp_local,
        end_timestamp: message.timestamp_local,
        gap_minutes: roundTo(gapMinutes),
        from_sender_label: previous.sender_label,
        to_sender_label: message.sender_label,
      };
    })
    .filter((gap) => gap.gap_minutes > 0)
    .sort((left, right) => right.gap_minutes - left.gap_minutes)
    .slice(0, 6);

  const fastestExchangeWindows = [...sessionGroups.entries()]
    .map(([technicalSessionId, sessionMessages]) => {
      const replyGapMessages = sessionMessages.filter((message) => message.reply_gap_minutes !== null);
      const averageReplyGapMinutes =
        replyGapMessages.reduce((sum, message) => sum + (message.reply_gap_minutes ?? 0), 0) /
        Math.max(replyGapMessages.length, 1);
      return {
        technical_session_id: technicalSessionId,
        start_timestamp: sessionMessages[0].timestamp_local,
        end_timestamp: sessionMessages.at(-1)!.timestamp_local,
        average_reply_gap_minutes: roundTo(averageReplyGapMinutes),
        message_count: sessionMessages.length,
      };
    })
    .filter((session) => session.message_count >= 20)
    .sort((left, right) => left.average_reply_gap_minutes - right.average_reply_gap_minutes)
    .slice(0, 6);

  const overallEmotionMix = sortCountMap(emotionCounts).map(([label, count]) => ({
    label: label as EmotionLabel,
    count,
  }));
  const overallArchetypeMix = sortCountMap(archetypeCounts).map(([label, count]) => ({
    label: label as ArchetypeLabel,
    count,
  }));

  const participantEmotionMix = participants.map((participant) => ({
    participant_id: participant.participant_id,
    label: participant.label,
    breakdown: sortCountMap(participantEmotionCounts.get(participant.participant_id) ?? new Map()).map(
      ([label, count]) => ({
        label,
        count,
      }),
    ),
  }));

  const participantArchetypeMix = participants.map((participant) => ({
    participant_id: participant.participant_id,
    label: participant.label,
    breakdown: sortCountMap(participantArchetypeCounts.get(participant.participant_id) ?? new Map()).map(
      ([label, count]) => ({
        label,
        count,
      }),
    ),
  }));
  const participantSignalTotals = participants.map((participant) => {
    const counts = participantSignalCounts.get(participant.participant_id) ?? {
      support_count: 0,
      conflict_count: 0,
      repair_count: 0,
    };

    return {
      participant_id: participant.participant_id,
      label: participant.label,
      support_count: counts.support_count,
      conflict_count: counts.conflict_count,
      repair_count: counts.repair_count,
    };
  });

  const monthAverageThreshold =
    monthlySplit.reduce((sum, month) => sum + month.total_messages, 0) / Math.max(monthlySplit.length, 1);
  const eligibleBalancedMonths = monthlySplit.filter(
    (month) => month.total_messages >= Math.max(200, Math.round(monthAverageThreshold * 0.35)),
  );
  const mostBalancedMonth =
    eligibleBalancedMonths
      .map((month) => {
        const counts = participants.map(
          (participant) => month.participant_counts[participant.participant_id] ?? 0,
        );
        const [highest, lowest] = [Math.max(...counts), Math.min(...counts)];
        return {
          ...month,
          balance_ratio: highest === 0 ? 1 : Math.abs(highest - lowest) / highest,
        };
      })
      .sort((left, right) => left.balance_ratio - right.balance_ratio || right.total_messages - left.total_messages)[0] ??
    null;

  const mostActiveMonth = [...monthlySplit].sort((left, right) => right.total_messages - left.total_messages)[0] ?? null;
  const mostIntenseWeek =
    [...weekGroups.entries()]
      .map(([weekKey, weekMessages]) => ({
        week_key: weekKey,
        count: weekMessages.length,
        supporting_message_ids: weekMessages.slice(0, 3).map((message) => message.message_id),
      }))
      .sort((left, right) => right.count - left.count)[0] ?? null;
  const highestSupportStretch =
    [...signalTrend.entries()]
      .map(([monthKey, counts]) => ({
        month_key: monthKey,
        ...counts,
        supporting_message_ids: (monthGroups.get(monthKey) ?? []).slice(0, 3).map((message) => message.message_id),
      }))
      .sort((left, right) => right.support_count - left.support_count)[0] ?? null;
  const strongestRepairStretch =
    [...signalTrend.entries()]
      .map(([monthKey, counts]) => ({
        month_key: monthKey,
        ...counts,
        supporting_message_ids: (monthGroups.get(monthKey) ?? []).slice(0, 3).map((message) => message.message_id),
      }))
      .sort((left, right) => right.repair_count - left.repair_count)[0] ?? null;

  const participantWithMostMessages = [...participantOverview].sort(
    (left, right) => right.total_messages - left.total_messages,
  )[0];
  const participantWithFastestReplies = [...participantOverview].sort(
    (left, right) => left.average_reply_gap_minutes - right.average_reply_gap_minutes,
  )[0];
  const participantWithMostEmoji = [...participantOverview].sort(
    (left, right) => right.emoji_count - left.emoji_count,
  )[0];
  const participantWithMostLateNight = [...participantOverview].sort(
    (left, right) => right.late_night_percentage - left.late_night_percentage,
  )[0];
  const participantWithLongestMessages = [...participantOverview].sort(
    (left, right) => right.average_chars_per_message - left.average_chars_per_message,
  )[0];
  const participantWithMostLinks = [...participantOverview].sort(
    (left, right) => right.link_count - left.link_count,
  )[0];
  const participantWithMostSessionOpeners = [...participantOverview].sort(
    (left, right) => right.session_opener_count - left.session_opener_count,
  )[0];
  const participantWithMostMultiline = [...participantOverview].sort(
    (left, right) => right.multiline_count - left.multiline_count,
  )[0];
  const participantWithMostWeekend = [...participantOverview].sort(
    (left, right) => right.weekend_percentage - left.weekend_percentage,
  )[0];
  const biggestMonthlyTakeover =
    [...monthWinners]
      .filter((month) => month.winner_participant_id !== null)
      .sort((left, right) => right.margin - left.margin || right.total_messages - left.total_messages)[0] ?? null;
  const mostNightOwlMonth =
    [...lateNightTrend]
      .filter((month) => month.total_messages >= 400)
      .sort((left, right) => right.late_night_share - left.late_night_share || right.total_messages - left.total_messages)[0] ??
    null;

  const detectiveRecords: DashboardInsights["detective_records"] = [
    {
      record_id: "who_sent_more",
      label: "Who sent more",
      value: participantWithMostMessages
        ? `${participantWithMostMessages.label} · ${formatCompactNumber(participantWithMostMessages.total_messages)}`
        : "N/A",
      detail: participantWithMostMessages
        ? `${participantWithMostMessages.message_share.toFixed(1)}% of the archive`
        : "No data",
      winner_participant_id: participantWithMostMessages?.participant_id ?? null,
      winner_label: participantWithMostMessages?.label ?? null,
      route: "/dashboard/",
      supporting_message_ids: activeMessages
        .filter((message) => message.sender_id === participantWithMostMessages?.participant_id)
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "who_replied_faster",
      label: "Who replied faster",
      value: participantWithFastestReplies
        ? `${participantWithFastestReplies.label} · ${participantWithFastestReplies.average_reply_gap_minutes.toFixed(1)} min`
        : "N/A",
      detail: "Average reply gap across the archive",
      winner_participant_id: participantWithFastestReplies?.participant_id ?? null,
      winner_label: participantWithFastestReplies?.label ?? null,
      route: "/patterns/",
      supporting_message_ids: activeMessages
        .filter((message) => message.sender_id === participantWithFastestReplies?.participant_id)
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "who_used_more_emojis",
      label: "Who used more emojis",
      value: participantWithMostEmoji
        ? `${participantWithMostEmoji.label} · ${formatCompactNumber(participantWithMostEmoji.emoji_count)}`
        : "N/A",
      detail: "Total emoji count across all sent messages",
      winner_participant_id: participantWithMostEmoji?.participant_id ?? null,
      winner_label: participantWithMostEmoji?.label ?? null,
      route: "/dashboard/",
      supporting_message_ids: activeMessages
        .filter((message) => message.sender_id === participantWithMostEmoji?.participant_id && message.emoji_count > 0)
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "who_texted_later",
      label: "Who texted later",
      value: participantWithMostLateNight
        ? `${participantWithMostLateNight.label} · ${participantWithMostLateNight.late_night_percentage.toFixed(1)}%`
        : "N/A",
      detail: "Share of each participant's messages sent after 10 PM",
      winner_participant_id: participantWithMostLateNight?.participant_id ?? null,
      winner_label: participantWithMostLateNight?.label ?? null,
      route: "/timeline/",
      supporting_message_ids: activeMessages
        .filter(
          (message) =>
            message.sender_id === participantWithMostLateNight?.participant_id &&
            PROJECT_CONFIG.lateNightHours.includes(message.hour_of_day),
        )
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "most_active_month",
      label: "Most active month",
      value: mostActiveMonth
        ? `${mostActiveMonth.month_key} · ${formatCompactNumber(mostActiveMonth.total_messages)}`
        : "N/A",
      detail: "The archive's loudest month by message volume",
      winner_participant_id: null,
      winner_label: null,
      route: "/timeline/",
      supporting_message_ids: (monthGroups.get(mostActiveMonth?.month_key ?? "") ?? [])
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "most_intense_week",
      label: "Most intense week",
      value: mostIntenseWeek
        ? `${mostIntenseWeek.week_key} · ${formatCompactNumber(mostIntenseWeek.count)}`
        : "N/A",
      detail: "Peak weekly exchange volume",
      winner_participant_id: null,
      winner_label: null,
      route: "/timeline/",
      supporting_message_ids: mostIntenseWeek?.supporting_message_ids ?? [],
    },
    {
      record_id: "most_balanced_month",
      label: "Most balanced month",
      value: mostBalancedMonth
        ? `${mostBalancedMonth.month_key} · ${formatCompactNumber(mostBalancedMonth.total_messages)}`
        : "N/A",
      detail: mostBalancedMonth
        ? "The closest split between both sides without dropping into a quiet period"
        : "No balanced month found",
      winner_participant_id: null,
      winner_label: null,
      route: "/dashboard/",
      supporting_message_ids: (monthGroups.get(mostBalancedMonth?.month_key ?? "") ?? [])
        .slice(0, 3)
        .map((message) => message.message_id),
    },
    {
      record_id: "highest_support_stretch",
      label: "Highest support stretch",
      value: highestSupportStretch
        ? `${highestSupportStretch.month_key} · ${formatCompactNumber(highestSupportStretch.support_count)}`
        : "N/A",
      detail: "Where support signals clustered most heavily",
      winner_participant_id: null,
      winner_label: null,
      route: "/lenses/reassurance/",
      supporting_message_ids: highestSupportStretch?.supporting_message_ids ?? [],
    },
    {
      record_id: "strongest_repair_stretch",
      label: "Strongest repair stretch",
      value: strongestRepairStretch
        ? `${strongestRepairStretch.month_key} · ${formatCompactNumber(strongestRepairStretch.repair_count)}`
        : "N/A",
      detail: "The stretch with the clearest repair energy",
      winner_participant_id: null,
      winner_label: null,
      route: "/lenses/repair-reconnection/",
      supporting_message_ids: strongestRepairStretch?.supporting_message_ids ?? [],
    },
  ];

  const additionalDetectiveRecords: DashboardInsights["detective_records"] = [
      {
        record_id: "who_writes_longer",
        label: "Who writes longer messages",
        value: participantWithLongestMessages
          ? `${participantWithLongestMessages.label} - ${participantWithLongestMessages.average_chars_per_message.toFixed(1)} chars/msg`
          : "N/A",
        detail: "Average character length per sent message",
        winner_participant_id: participantWithLongestMessages?.participant_id ?? null,
        winner_label: participantWithLongestMessages?.label ?? null,
        route: "/dashboard/",
        supporting_message_ids: activeMessages
          .filter((message) => message.sender_id === participantWithLongestMessages?.participant_id)
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "who_shares_more_links",
        label: "Who shares more links",
        value: participantWithMostLinks
          ? `${participantWithMostLinks.label} - ${formatCompactNumber(participantWithMostLinks.link_count)}`
          : "N/A",
        detail: "Total links dropped across the archive",
        winner_participant_id: participantWithMostLinks?.participant_id ?? null,
        winner_label: participantWithMostLinks?.label ?? null,
        route: "/dashboard/",
        supporting_message_ids: activeMessages
          .filter((message) => message.sender_id === participantWithMostLinks?.participant_id && message.has_url)
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "who_starts_more_conversations",
        label: "Who starts more conversations",
        value: participantWithMostSessionOpeners
          ? `${participantWithMostSessionOpeners.label} - ${formatCompactNumber(participantWithMostSessionOpeners.session_opener_count)}`
          : "N/A",
        detail: "Who opens more technical sessions",
        winner_participant_id: participantWithMostSessionOpeners?.participant_id ?? null,
        winner_label: participantWithMostSessionOpeners?.label ?? null,
        route: "/dashboard/",
        supporting_message_ids: activeMessages
          .filter((message) => message.sender_id === participantWithMostSessionOpeners?.participant_id)
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "who_sends_more_multiline",
        label: "Who sends more multiline notes",
        value: participantWithMostMultiline
          ? `${participantWithMostMultiline.label} - ${formatCompactNumber(participantWithMostMultiline.multiline_count)}`
          : "N/A",
        detail: "Longer note-style messages instead of one-liners",
        winner_participant_id: participantWithMostMultiline?.participant_id ?? null,
        winner_label: participantWithMostMultiline?.label ?? null,
        route: "/moments/",
        supporting_message_ids: activeMessages
          .filter((message) => message.sender_id === participantWithMostMultiline?.participant_id && message.is_multiline)
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "who_owns_more_weekends",
        label: "Who owns more weekends",
        value: participantWithMostWeekend
          ? `${participantWithMostWeekend.label} - ${participantWithMostWeekend.weekend_percentage.toFixed(1)}%`
          : "N/A",
        detail: "Share of each person's messages sent on weekends",
        winner_participant_id: participantWithMostWeekend?.participant_id ?? null,
        winner_label: participantWithMostWeekend?.label ?? null,
        route: "/patterns/",
        supporting_message_ids: activeMessages
          .filter(
            (message) =>
              message.sender_id === participantWithMostWeekend?.participant_id &&
              (message.weekday === 0 || message.weekday === 6),
          )
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "biggest_monthly_takeover",
        label: "Biggest monthly takeover",
        value:
          biggestMonthlyTakeover && biggestMonthlyTakeover.winner_label
            ? `${biggestMonthlyTakeover.month_key} - ${biggestMonthlyTakeover.winner_label}`
            : "N/A",
        detail:
          biggestMonthlyTakeover && biggestMonthlyTakeover.winner_label
            ? `${formatCompactNumber(biggestMonthlyTakeover.margin)} message lead`
            : "No clear monthly winner",
        winner_participant_id: biggestMonthlyTakeover?.winner_participant_id ?? null,
        winner_label: biggestMonthlyTakeover?.winner_label ?? null,
        route: "/timeline/",
        supporting_message_ids: (monthGroups.get(biggestMonthlyTakeover?.month_key ?? "") ?? [])
          .slice(0, 3)
          .map((message) => message.message_id),
      },
      {
        record_id: "most_night_owl_month",
        label: "Most night-owl month",
        value: mostNightOwlMonth
          ? `${mostNightOwlMonth.month_key} - ${mostNightOwlMonth.late_night_share.toFixed(1)}%`
          : "N/A",
        detail: "Month with the highest late-night message share",
        winner_participant_id: null,
        winner_label: null,
        route: "/timeline/",
        supporting_message_ids: (monthGroups.get(mostNightOwlMonth?.month_key ?? "") ?? [])
          .slice(0, 3)
          .map((message) => message.message_id),
      },
    ];
  const expandedDetectiveRecords: DashboardInsights["detective_records"] = [
    ...detectiveRecords.map((record) => ({
      ...record,
      value: record.value.replaceAll("Â·", "-").replaceAll("·", "-"),
    })),
    ...additionalDetectiveRecords,
  ];

  return {
    generated_at: new Date().toISOString(),
    participants: participantOverview,
    time_patterns: {
      monthly_split: monthlySplit,
      weekday_distribution: weekdayDistribution,
      hour_distribution: hourDistribution,
      late_night_trend: lateNightTrend,
      month_winners: monthWinners,
      participant_peak_windows: participantPeakWindows,
      busiest_windows: [...hourWindowCounts]
        .sort((left, right) => right.count - left.count)
        .slice(0, 6),
      quietest_windows: [...hourWindowCounts]
        .filter((window) => window.count > 0)
        .sort((left, right) => left.count - right.count)
        .slice(0, 6),
    },
    session_patterns: {
      longest_sessions: [...technicalSessions]
        .sort((left, right) => right.message_count - left.message_count)
        .slice(0, 6)
        .map((session) => ({
          technical_session_id: session.technical_session_id,
          start_timestamp: session.start_timestamp,
          end_timestamp: session.end_timestamp,
          message_count: session.message_count,
          density_score: roundTo(session.density_score),
          dominant_emotion: session.dominant_emotion,
          participant_counts: session.participant_message_counts,
        })),
      densest_sessions: [...technicalSessions]
        .sort((left, right) => right.density_score - left.density_score)
        .slice(0, 6)
        .map((session) => ({
          technical_session_id: session.technical_session_id,
          start_timestamp: session.start_timestamp,
          end_timestamp: session.end_timestamp,
          message_count: session.message_count,
          density_score: roundTo(session.density_score),
          dominant_emotion: session.dominant_emotion,
          participant_counts: session.participant_message_counts,
        })),
      highest_volume_days: highestVolumeDays,
      longest_silence_gaps: silenceGaps,
      fastest_exchange_windows: fastestExchangeWindows,
    },
    emotion_patterns: {
      overall_emotion_mix: overallEmotionMix,
      participant_emotion_mix: participantEmotionMix,
      overall_archetype_mix: overallArchetypeMix,
      participant_archetype_mix: participantArchetypeMix,
      participant_signal_totals: participantSignalTotals,
      chapter_tone_matrix: chapters.map((chapter) => ({
        chapter_id: chapter.chapter_id,
        slug: chapter.slug,
        title: chapter.title,
        dominant_emotion: chapter.dominant_emotion,
        dominant_archetype: chapter.dominant_archetypes[0] ?? "everyday_life",
        message_count: chapter.message_count,
      })),
      signal_trend: [...signalTrend.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([monthKey, counts]) => ({
          month_key: monthKey,
          support_count: counts.support_count,
          conflict_count: counts.conflict_count,
          repair_count: counts.repair_count,
        })),
    },
    detective_records: expandedDetectiveRecords,
  };
}
