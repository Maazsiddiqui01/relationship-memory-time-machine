import { z } from "zod";

import { ARCHETYPE_LABELS, EMOTION_LABELS, TOPIC_LABELS } from "./config.js";

export const MessageTypeSchema = z.enum(["text", "media_omitted", "deleted", "system"]);
export const EmotionLabelSchema = z.enum(EMOTION_LABELS);
export const ArchetypeLabelSchema = z.enum(ARCHETYPE_LABELS);
export const TopicLabelSchema = z.enum(TOPIC_LABELS);

export const ParticipantSchema = z.object({
  participant_id: z.string(),
  label: z.string(),
  message_count: z.number().int().nonnegative(),
  first_message_id: z.string().nullable(),
});

export const CanonicalMessageSchema = z.object({
  message_id: z.string(),
  source_file: z.string(),
  source_line_start: z.number().int().positive(),
  source_line_end: z.number().int().positive(),
  timestamp_raw: z.string(),
  timestamp_local: z.string(),
  timezone_assumed: z.string(),
  sender_id: z.string().nullable(),
  sender_label: z.string().nullable(),
  message_type: MessageTypeSchema,
  text: z.string(),
  normalized_text: z.string(),
  has_url: z.boolean(),
  char_count: z.number().int().nonnegative(),
  word_count: z.number().int().nonnegative(),
  emoji_count: z.number().int().nonnegative(),
  is_multiline: z.boolean(),
  technical_session_id: z.string(),
  reply_gap_minutes: z.number().nullable(),
  hour_of_day: z.number().int().min(0).max(23),
  weekday: z.number().int().min(0).max(6),
  day_key: z.string(),
  week_key: z.string(),
  month_key: z.string(),
});

export const ChunkSchema = z.object({
  chunk_id: z.string(),
  chunk_index: z.number().int().nonnegative(),
  chunk_hash: z.string(),
  technical_session_ids: z.array(z.string()),
  start_message_id: z.string(),
  end_message_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  message_ids: z.array(z.string()),
});

export const MessageAnnotationSchema = z.object({
  message_id: z.string(),
  chunk_ids: z.array(z.string()),
  emotion_label: EmotionLabelSchema,
  emotion_intensity: z.number().min(0).max(1),
  importance_score: z.number().min(0).max(1),
  topic_tags: z.array(TopicLabelSchema).min(1),
  archetype_tags: z.array(ArchetypeLabelSchema).min(1),
  highlight_candidate: z.boolean(),
  milestone_candidate: z.boolean(),
  support_signal: z.boolean(),
  conflict_signal: z.boolean(),
  repair_signal: z.boolean(),
  evidence_score: z.number().min(0).max(1),
  analysis_provider: z.string(),
  prompt_version: z.string(),
});

export const ChunkAnnotationSchema = z.object({
  chunk_id: z.string(),
  summary: z.string(),
  dominant_emotions: z.array(EmotionLabelSchema).min(1),
  dominant_topics: z.array(TopicLabelSchema).min(1),
  dominant_archetypes: z.array(ArchetypeLabelSchema).min(1),
  highlight_candidate_message_ids: z.array(z.string()),
  milestone_candidate_message_ids: z.array(z.string()),
  segment_transition_message_ids: z.array(z.string()),
  analysis_provider: z.string(),
  prompt_version: z.string(),
});

export const TechnicalSessionSummarySchema = z.object({
  technical_session_id: z.string(),
  start_message_id: z.string(),
  end_message_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  message_count: z.number().int().positive(),
  participant_message_counts: z.record(z.string(), z.number().int().nonnegative()),
  dominant_emotion: EmotionLabelSchema,
  dominant_topics: z.array(TopicLabelSchema).min(1),
  dominant_archetypes: z.array(ArchetypeLabelSchema).min(1),
  average_importance: z.number().min(0).max(1),
  density_score: z.number().min(0),
  highlight_message_ids: z.array(z.string()),
});

export const NarrativeSegmentSchema = z.object({
  narrative_segment_id: z.string(),
  title: z.string(),
  summary: z.string(),
  start_message_id: z.string(),
  end_message_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  message_count: z.number().int().positive(),
  technical_session_ids: z.array(z.string()).min(1),
  dominant_emotion: EmotionLabelSchema,
  dominant_topics: z.array(TopicLabelSchema).min(1),
  dominant_archetypes: z.array(ArchetypeLabelSchema).min(1),
  turning_point: z.boolean(),
  conflict_repair_cycle: z.boolean(),
  highlight_message_ids: z.array(z.string()),
});

export const SegmentAnnotationSchema = z.object({
  narrative_segment_id: z.string(),
  summary: z.string(),
  dominant_tone: EmotionLabelSchema,
  dominant_topics: z.array(TopicLabelSchema).min(1),
  dominant_archetypes: z.array(ArchetypeLabelSchema).min(1),
  turning_point: z.boolean(),
  conflict_repair_cycle: z.boolean(),
});

export const HighlightSchema = z.object({
  highlight_id: z.string(),
  message_id: z.string(),
  timestamp_local: z.string(),
  sender_id: z.string().nullable(),
  sender_label: z.string().nullable(),
  quote: z.string(),
  emotion_label: EmotionLabelSchema,
  archetype_tags: z.array(ArchetypeLabelSchema).min(1),
  topic_tags: z.array(TopicLabelSchema).min(1),
  importance_score: z.number().min(0).max(1),
  narrative_segment_id: z.string().nullable(),
  chapter_id: z.string().nullable(),
});

export const MilestoneSchema = z.object({
  milestone_id: z.string(),
  milestone_type: z.string(),
  title: z.string(),
  summary: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  message_ids: z.array(z.string()).min(1),
  representative_quote: z.string(),
  narrative_segment_id: z.string().nullable(),
  chapter_id: z.string().nullable(),
  importance_score: z.number().min(0).max(1),
});

export const ChapterSegmentSchema = z.object({
  chapter_id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  narrative_segment_ids: z.array(z.string()).min(1),
  milestone_ids: z.array(z.string()),
  highlight_ids: z.array(z.string()),
  dominant_emotion: EmotionLabelSchema,
  dominant_topics: z.array(TopicLabelSchema).min(1),
  dominant_archetypes: z.array(ArchetypeLabelSchema).min(1),
  message_count: z.number().int().positive(),
});

export const TopicClusterSchema = z.object({
  topic_id: z.string(),
  label: TopicLabelSchema,
  count: z.number().int().positive(),
  representative_message_ids: z.array(z.string()).min(1),
  representative_quotes: z.array(z.string()).min(1),
});

export const PhraseMotifSchema = z.object({
  motif_id: z.string(),
  label: z.string(),
  normalized_phrase: z.string(),
  count: z.number().int().positive(),
  representative_message_ids: z.array(z.string()).min(1),
  archetype_hint: ArchetypeLabelSchema.nullable(),
});

export const InsideJokeSchema = z.object({
  inside_joke_id: z.string(),
  label: z.string(),
  count: z.number().int().positive(),
  representative_message_ids: z.array(z.string()).min(1),
  summary: z.string(),
});

export const EmotionTimelinePointSchema = z.object({
  period_start: z.string(),
  period_label: z.string(),
  average_intensity: z.number().min(0).max(1),
  dominant_emotion: EmotionLabelSchema,
  message_count: z.number().int().nonnegative(),
});

export const MessageFrequencySchema = z.object({
  summary: z.object({
    total_messages: z.number().int().nonnegative(),
    active_days: z.number().int().nonnegative(),
    average_daily_messages: z.number().nonnegative(),
  }),
  daily_counts: z.array(
    z.object({
      day_key: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  heatmap_bins: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      hour_of_day: z.number().int().min(0).max(23),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export const SignatureMetricsSchema = z.object({
  generated_at: z.string(),
  headline: z.object({
    total_messages: z.number().int().nonnegative(),
    average_daily_messages: z.number().nonnegative(),
    longest_daily_streak: z.number().int().nonnegative(),
    most_active_day: z.object({
      day_key: z.string(),
      count: z.number().int().nonnegative(),
    }),
    most_active_month: z.object({
      month_key: z.string(),
      count: z.number().int().nonnegative(),
    }),
    longest_technical_session: z.object({
      technical_session_id: z.string(),
      message_count: z.number().int().nonnegative(),
    }),
    late_night_percentage: z.number().min(0).max(100),
    support_moments_count: z.number().int().nonnegative(),
    conflict_repair_cycles: z.number().int().nonnegative(),
  }),
  participant_reply_gaps: z.array(
    z.object({
      participant_id: z.string(),
      label: z.string(),
      average_reply_gap_minutes: z.number().nonnegative(),
    }),
  ),
  chapter_tones: z.array(
    z.object({
      chapter_id: z.string(),
      title: z.string(),
      dominant_emotion: EmotionLabelSchema,
    }),
  ),
  story_spotlights: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      supporting_message_ids: z.array(z.string()),
    }),
  ),
});

const DashboardCountBreakdownSchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
});

const DashboardParticipantOverviewSchema = z.object({
  participant_id: z.string(),
  label: z.string(),
  total_messages: z.number().int().nonnegative(),
  message_share: z.number().min(0).max(100),
  total_words: z.number().int().nonnegative(),
  average_words_per_message: z.number().nonnegative(),
  average_chars_per_message: z.number().nonnegative(),
  emoji_count: z.number().int().nonnegative(),
  emoji_share: z.number().min(0).max(100),
  emoji_per_message: z.number().nonnegative(),
  link_count: z.number().int().nonnegative(),
  link_share: z.number().min(0).max(100),
  multiline_count: z.number().int().nonnegative(),
  multiline_share: z.number().min(0).max(100),
  weekend_percentage: z.number().min(0).max(100),
  late_night_percentage: z.number().min(0).max(100),
  session_opener_count: z.number().int().nonnegative(),
  session_opener_share: z.number().min(0).max(100),
  longest_message_length: z.number().int().nonnegative(),
  average_reply_gap_minutes: z.number().nonnegative(),
});

const DashboardTimeDistributionSchema = z.object({
  label: z.string(),
  total_messages: z.number().int().nonnegative(),
  participant_counts: z.record(z.string(), z.number().int().nonnegative()),
});

const DashboardMonthlySplitSchema = z.object({
  month_key: z.string(),
  total_messages: z.number().int().nonnegative(),
  participant_counts: z.record(z.string(), z.number().int().nonnegative()),
  late_night_count: z.number().int().nonnegative(),
});

const DashboardWeekdayDistributionSchema = DashboardTimeDistributionSchema.extend({
  weekday: z.number().int().min(0).max(6),
});

const DashboardHourDistributionSchema = DashboardTimeDistributionSchema.extend({
  hour_of_day: z.number().int().min(0).max(23),
});

const DashboardLateNightTrendSchema = z.object({
  month_key: z.string(),
  total_messages: z.number().int().nonnegative(),
  late_night_messages: z.number().int().nonnegative(),
  late_night_share: z.number().min(0).max(100),
  participant_counts: z.record(z.string(), z.number().int().nonnegative()),
});

const DashboardTimeWindowSchema = z.object({
  label: z.string(),
  weekday: z.number().int().min(0).max(6),
  hour_of_day: z.number().int().min(0).max(23),
  count: z.number().int().nonnegative(),
});

const DashboardMonthWinnerSchema = z.object({
  month_key: z.string(),
  winner_participant_id: z.string().nullable(),
  winner_label: z.string().nullable(),
  winner_count: z.number().int().nonnegative(),
  margin: z.number().int().nonnegative(),
  total_messages: z.number().int().nonnegative(),
});

const DashboardParticipantPeakWindowsSchema = z.object({
  participant_id: z.string(),
  label: z.string(),
  top_windows: z.array(DashboardTimeWindowSchema),
  top_weekdays: z.array(
    z.object({
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  top_hours: z.array(
    z.object({
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

const DashboardSessionSnapshotSchema = z.object({
  technical_session_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  message_count: z.number().int().nonnegative(),
  density_score: z.number().nonnegative(),
  dominant_emotion: EmotionLabelSchema,
  participant_counts: z.record(z.string(), z.number().int().nonnegative()),
});

const DashboardDayRecordSchema = z.object({
  day_key: z.string(),
  count: z.number().int().nonnegative(),
});

const DashboardSilenceGapSchema = z.object({
  from_message_id: z.string(),
  to_message_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  gap_minutes: z.number().nonnegative(),
  from_sender_label: z.string().nullable(),
  to_sender_label: z.string().nullable(),
});

const DashboardExchangeWindowSchema = z.object({
  technical_session_id: z.string(),
  start_timestamp: z.string(),
  end_timestamp: z.string(),
  average_reply_gap_minutes: z.number().nonnegative(),
  message_count: z.number().int().nonnegative(),
});

const DashboardParticipantEmotionMixSchema = z.object({
  participant_id: z.string(),
  label: z.string(),
  breakdown: z.array(DashboardCountBreakdownSchema),
});

const DashboardChapterToneSchema = z.object({
  chapter_id: z.string(),
  slug: z.string(),
  title: z.string(),
  dominant_emotion: EmotionLabelSchema,
  dominant_archetype: ArchetypeLabelSchema,
  message_count: z.number().int().nonnegative(),
});

const DashboardSignalTrendSchema = z.object({
  month_key: z.string(),
  support_count: z.number().int().nonnegative(),
  conflict_count: z.number().int().nonnegative(),
  repair_count: z.number().int().nonnegative(),
});

const DashboardParticipantSignalTotalsSchema = z.object({
  participant_id: z.string(),
  label: z.string(),
  support_count: z.number().int().nonnegative(),
  conflict_count: z.number().int().nonnegative(),
  repair_count: z.number().int().nonnegative(),
});

const DashboardRecordSchema = z.object({
  record_id: z.string(),
  label: z.string(),
  value: z.string(),
  detail: z.string(),
  winner_participant_id: z.string().nullable(),
  winner_label: z.string().nullable(),
  route: z.string().nullable(),
  supporting_message_ids: z.array(z.string()),
});

export const DashboardInsightsSchema = z.object({
  generated_at: z.string(),
  participants: z.array(DashboardParticipantOverviewSchema).min(1),
  time_patterns: z.object({
    monthly_split: z.array(DashboardMonthlySplitSchema),
    weekday_distribution: z.array(DashboardWeekdayDistributionSchema),
    hour_distribution: z.array(DashboardHourDistributionSchema),
    late_night_trend: z.array(DashboardLateNightTrendSchema),
    month_winners: z.array(DashboardMonthWinnerSchema),
    participant_peak_windows: z.array(DashboardParticipantPeakWindowsSchema),
    busiest_windows: z.array(DashboardTimeWindowSchema),
    quietest_windows: z.array(DashboardTimeWindowSchema),
  }),
  session_patterns: z.object({
    longest_sessions: z.array(DashboardSessionSnapshotSchema),
    densest_sessions: z.array(DashboardSessionSnapshotSchema),
    highest_volume_days: z.array(DashboardDayRecordSchema),
    longest_silence_gaps: z.array(DashboardSilenceGapSchema),
    fastest_exchange_windows: z.array(DashboardExchangeWindowSchema),
  }),
  emotion_patterns: z.object({
    overall_emotion_mix: z.array(
      DashboardCountBreakdownSchema.extend({
        label: EmotionLabelSchema,
      }),
    ),
    participant_emotion_mix: z.array(DashboardParticipantEmotionMixSchema),
    overall_archetype_mix: z.array(
      DashboardCountBreakdownSchema.extend({
        label: ArchetypeLabelSchema,
      }),
    ),
    participant_archetype_mix: z.array(DashboardParticipantEmotionMixSchema),
    participant_signal_totals: z.array(DashboardParticipantSignalTotalsSchema),
    chapter_tone_matrix: z.array(DashboardChapterToneSchema),
    signal_trend: z.array(DashboardSignalTrendSchema),
  }),
  detective_records: z.array(DashboardRecordSchema),
});

export const CuratedHomepageSchema = z.object({
  generated_at: z.string(),
  intro: z.object({
    title: z.string(),
    subtitle: z.string(),
    time_span: z.string(),
  }),
  headline_metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      supporting_message_ids: z.array(z.string()),
    }),
  ),
  selected_highlights: z.array(HighlightSchema),
  milestone_previews: z.array(MilestoneSchema),
  chapter_previews: z.array(ChapterSegmentSchema),
  emotional_arc_summary: z.object({
    opening_tone: EmotionLabelSchema,
    midpoint_tone: EmotionLabelSchema,
    closing_tone: EmotionLabelSchema,
    peak_period: z.string(),
  }),
  signature_spotlights: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      supporting_message_ids: z.array(z.string()),
    }),
  ),
});

export const MessagesManifestSchema = z.object({
  total_messages: z.number().int().nonnegative(),
  shard_count: z.number().int().nonnegative(),
  shards: z.array(
    z.object({
      shard_id: z.string(),
      path: z.string(),
      month_key: z.string(),
      message_count: z.number().int().nonnegative(),
      start_timestamp: z.string(),
      end_timestamp: z.string(),
    }),
  ),
});

export type CanonicalMessage = z.infer<typeof CanonicalMessageSchema>;
export type ChunkRecord = z.infer<typeof ChunkSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type MessageAnnotation = z.infer<typeof MessageAnnotationSchema>;
export type ChunkAnnotation = z.infer<typeof ChunkAnnotationSchema>;
export type TechnicalSessionSummary = z.infer<typeof TechnicalSessionSummarySchema>;
export type NarrativeSegment = z.infer<typeof NarrativeSegmentSchema>;
export type SegmentAnnotation = z.infer<typeof SegmentAnnotationSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type ChapterSegment = z.infer<typeof ChapterSegmentSchema>;
export type TopicCluster = z.infer<typeof TopicClusterSchema>;
export type PhraseMotif = z.infer<typeof PhraseMotifSchema>;
export type InsideJoke = z.infer<typeof InsideJokeSchema>;
export type EmotionTimelinePoint = z.infer<typeof EmotionTimelinePointSchema>;
export type MessageFrequency = z.infer<typeof MessageFrequencySchema>;
export type SignatureMetrics = z.infer<typeof SignatureMetricsSchema>;
export type DashboardInsights = z.infer<typeof DashboardInsightsSchema>;
export type CuratedHomepage = z.infer<typeof CuratedHomepageSchema>;
export type MessagesManifest = z.infer<typeof MessagesManifestSchema>;
