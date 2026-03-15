import { describe, expect, it } from "vitest";

import type { CanonicalMessage, MessageAnnotation } from "../pipeline/schemas.js";
import {
  buildEmotionTimeline,
  buildMessageFrequency,
  buildPhraseMotifCandidates,
  buildTechnicalSessionSummaries,
} from "../pipeline/exec/deterministic.js";

const messages: CanonicalMessage[] = [
  {
    message_id: "msg_0000001",
    source_file: "sample.txt",
    source_line_start: 1,
    source_line_end: 1,
    timestamp_raw: "01/01/2024, 10:00 am",
    timestamp_local: "2024-01-01T10:00:00",
    timezone_assumed: "Asia/Riyadh",
    sender_id: "participant_01",
    sender_label: "Alice",
    message_type: "text",
    text: "good morning",
    normalized_text: "good morning",
    has_url: false,
    char_count: 12,
    word_count: 2,
    emoji_count: 0,
    is_multiline: false,
    technical_session_id: "tech_0001",
    reply_gap_minutes: null,
    hour_of_day: 10,
    weekday: 1,
    day_key: "2024-01-01",
    week_key: "2024-01-01",
    month_key: "2024-01",
  },
  {
    message_id: "msg_0000002",
    source_file: "sample.txt",
    source_line_start: 2,
    source_line_end: 2,
    timestamp_raw: "01/01/2024, 10:03 am",
    timestamp_local: "2024-01-01T10:03:00",
    timezone_assumed: "Asia/Riyadh",
    sender_id: "participant_02",
    sender_label: "Bob",
    message_type: "text",
    text: "good morning",
    normalized_text: "good morning",
    has_url: false,
    char_count: 12,
    word_count: 2,
    emoji_count: 0,
    is_multiline: false,
    technical_session_id: "tech_0001",
    reply_gap_minutes: null,
    hour_of_day: 10,
    weekday: 1,
    day_key: "2024-01-01",
    week_key: "2024-01-01",
    month_key: "2024-01",
  },
  {
    message_id: "msg_0000003",
    source_file: "sample.txt",
    source_line_start: 3,
    source_line_end: 3,
    timestamp_raw: "02/01/2024, 11:00 pm",
    timestamp_local: "2024-01-02T23:00:00",
    timezone_assumed: "Asia/Riyadh",
    sender_id: "participant_01",
    sender_label: "Alice",
    message_type: "text",
    text: "see you tomorrow",
    normalized_text: "see you tomorrow",
    has_url: false,
    char_count: 16,
    word_count: 3,
    emoji_count: 0,
    is_multiline: false,
    technical_session_id: "tech_0002",
    reply_gap_minutes: 120,
    hour_of_day: 23,
    weekday: 2,
    day_key: "2024-01-02",
    week_key: "2024-01-01",
    month_key: "2024-01",
  },
  {
    message_id: "msg_0000004",
    source_file: "sample.txt",
    source_line_start: 4,
    source_line_end: 4,
    timestamp_raw: "03/01/2024, 09:00 am",
    timestamp_local: "2024-01-03T09:00:00",
    timezone_assumed: "Asia/Riyadh",
    sender_id: "participant_02",
    sender_label: "Bob",
    message_type: "text",
    text: "good morning",
    normalized_text: "good morning",
    has_url: false,
    char_count: 12,
    word_count: 2,
    emoji_count: 0,
    is_multiline: false,
    technical_session_id: "tech_0003",
    reply_gap_minutes: 90,
    hour_of_day: 9,
    weekday: 3,
    day_key: "2024-01-03",
    week_key: "2024-01-01",
    month_key: "2024-01",
  },
];

const annotations = new Map<string, MessageAnnotation>([
  [
    "msg_0000001",
    {
      message_id: "msg_0000001",
      chunk_ids: ["chunk_00001"],
      emotion_label: "neutral",
      emotion_intensity: 0.3,
      importance_score: 0.32,
      topic_tags: ["daily_life"],
      archetype_tags: ["check-in"],
      highlight_candidate: false,
      milestone_candidate: false,
      support_signal: false,
      conflict_signal: false,
      repair_signal: false,
      evidence_score: 0.5,
      analysis_provider: "heuristic",
      prompt_version: "test",
    },
  ],
  [
    "msg_0000002",
    {
      message_id: "msg_0000002",
      chunk_ids: ["chunk_00001"],
      emotion_label: "funny",
      emotion_intensity: 0.6,
      importance_score: 0.74,
      topic_tags: ["humor"],
      archetype_tags: ["humor_banter"],
      highlight_candidate: true,
      milestone_candidate: false,
      support_signal: false,
      conflict_signal: false,
      repair_signal: false,
      evidence_score: 0.8,
      analysis_provider: "heuristic",
      prompt_version: "test",
    },
  ],
  [
    "msg_0000003",
    {
      message_id: "msg_0000003",
      chunk_ids: ["chunk_00002"],
      emotion_label: "supportive",
      emotion_intensity: 0.7,
      importance_score: 0.82,
      topic_tags: ["future_plans"],
      archetype_tags: ["planning"],
      highlight_candidate: true,
      milestone_candidate: true,
      support_signal: true,
      conflict_signal: false,
      repair_signal: false,
      evidence_score: 0.9,
      analysis_provider: "heuristic",
      prompt_version: "test",
    },
  ],
  [
    "msg_0000004",
    {
      message_id: "msg_0000004",
      chunk_ids: ["chunk_00003"],
      emotion_label: "neutral",
      emotion_intensity: 0.25,
      importance_score: 0.3,
      topic_tags: ["daily_life"],
      archetype_tags: ["check-in"],
      highlight_candidate: false,
      milestone_candidate: false,
      support_signal: false,
      conflict_signal: false,
      repair_signal: false,
      evidence_score: 0.45,
      analysis_provider: "heuristic",
      prompt_version: "test",
    },
  ],
]);

describe("deterministic utilities", () => {
  it("builds frequency and phrase motifs", () => {
    const frequency = buildMessageFrequency(messages);
    const motifs = buildPhraseMotifCandidates(messages);

    expect(frequency.summary.total_messages).toBe(4);
    expect(frequency.daily_counts).toHaveLength(3);
    expect(motifs[0]?.normalized_phrase).toBe("good morning");
  });

  it("builds emotion timelines and technical session summaries", () => {
    const emotionTimeline = buildEmotionTimeline(messages, annotations);
    const technicalSessions = buildTechnicalSessionSummaries(messages, annotations);

    expect(emotionTimeline).toHaveLength(1);
    expect(emotionTimeline[0].dominant_emotion).toBe("neutral");
    expect(technicalSessions).toHaveLength(3);
    expect(technicalSessions[0].dominant_archetypes[0]).toBe("check-in");
  });
});
