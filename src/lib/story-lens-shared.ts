export const STORY_LENS_ARCHETYPE_LABELS = [
  "check-in",
  "affection",
  "planning",
  "humor_banter",
  "reassurance",
  "conflict",
  "repair_reconnection",
  "longing_missing",
  "everyday_life",
  "future_imagining",
] as const;

export type ArchetypeLabel = (typeof STORY_LENS_ARCHETYPE_LABELS)[number];
export type EmotionLabel = "romantic" | "supportive" | "funny" | "neutral" | "conflict" | "nostalgic";
export type TopicLabel =
  | "daily_life"
  | "future_plans"
  | "relationship"
  | "humor"
  | "difficult_conversation"
  | "study_work"
  | "travel"
  | "support"
  | "longing";

type HighlightRecord = {
  highlight_id: string;
  message_id: string;
  timestamp_local: string;
  sender_id: string | null;
  sender_label: string | null;
  quote: string;
  emotion_label: EmotionLabel;
  archetype_tags: ArchetypeLabel[];
  topic_tags: TopicLabel[];
  importance_score: number;
  narrative_segment_id: string | null;
  chapter_id: string | null;
};

type MilestoneRecord = {
  milestone_id: string;
  milestone_type: string;
  title: string;
  summary: string;
  start_timestamp: string;
  end_timestamp: string;
  message_ids: string[];
  representative_quote: string;
  narrative_segment_id: string | null;
  chapter_id: string | null;
  importance_score: number;
};

type ChapterSegmentRecord = {
  chapter_id: string;
  slug: string;
  title: string;
  summary: string;
  start_timestamp: string;
  end_timestamp: string;
  narrative_segment_ids: string[];
  milestone_ids: string[];
  highlight_ids: string[];
  dominant_emotion: EmotionLabel;
  dominant_topics: TopicLabel[];
  dominant_archetypes: ArchetypeLabel[];
  message_count: number;
};

type PhraseMotifRecord = {
  motif_id: string;
  label: string;
  normalized_phrase: string;
  count: number;
  representative_message_ids: string[];
  archetype_hint: ArchetypeLabel | null;
};

export const LENS_META: Record<
  ArchetypeLabel,
  {
    title: string;
    teaser: string;
    mood: string;
  }
> = {
  "check-in": {
    title: "Check-Ins",
    teaser: "The small 'are you there?' moments that kept the thread intact.",
    mood: "quiet and steady",
  },
  affection: {
    title: "Affection",
    teaser: "The places where care stopped being implied and started showing clearly.",
    mood: "soft and glowing",
  },
  planning: {
    title: "Planning",
    teaser: "All the little plans that made later feel more concrete.",
    mood: "forward-looking",
  },
  humor_banter: {
    title: "Humor & Banter",
    teaser: "The teasing, play, and nonsense that kept recurring in the archive.",
    mood: "light and spark-filled",
  },
  reassurance: {
    title: "Reassurance",
    teaser: "The messages that steadied things when someone needed it.",
    mood: "calm and protective",
  },
  conflict: {
    title: "Conflict",
    teaser: "The harder edge of the archive, when care and friction sat in the same room.",
    mood: "tense and charged",
  },
  repair_reconnection: {
    title: "Repair & Reconnection",
    teaser: "The return after strain, when reaching back mattered more than being perfect.",
    mood: "tender and fragile",
  },
  longing_missing: {
    title: "Longing & Missing",
    teaser: "The ache, the distance, and the parts of the archive shaped by wanting more closeness.",
    mood: "wistful and intimate",
  },
  everyday_life: {
    title: "Everyday Closeness",
    teaser: "The ordinary messages that quietly became the core of the story.",
    mood: "domestic and lived-in",
  },
  future_imagining: {
    title: "Future Imagining",
    teaser: "The moments where the conversation started sounding like a future, not just a present.",
    mood: "hopeful and cinematic",
  },
};

export type StoryLens = {
  archetype: ArchetypeLabel;
  slug: string;
  title: string;
  teaser: string;
  mood: string;
  message_count: number;
  share_of_archive: number;
  dominant_emotion: EmotionLabel | "neutral";
  top_emotions: Array<{ label: string; count: number }>;
  top_topics: Array<{ label: TopicLabel; count: number }>;
  highlights: Array<
    HighlightRecord & {
      excerpt: string;
      display_quote: string;
      quality_score: number;
    }
  >;
  milestones: Array<
    MilestoneRecord & {
      display_title: string;
      short_summary: string;
      display_quote: string | null;
      quality_score: number;
    }
  >;
  chapters: Array<
    ChapterSegmentRecord & {
      display_title: string;
      phase_label: string;
      occurrence_index: number;
      lens_count: number;
    }
  >;
  motifs: PhraseMotifRecord[];
};

export function lensSlug(archetype: ArchetypeLabel): string {
  return archetype.replace(/_/gu, "-");
}

export function lensFromSlug(slug: string): ArchetypeLabel | undefined {
  return STORY_LENS_ARCHETYPE_LABELS.find((label) => lensSlug(label) === slug);
}

export function listStoryLensSlugs(): string[] {
  return STORY_LENS_ARCHETYPE_LABELS.map((label) => lensSlug(label));
}
