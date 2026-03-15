import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { cache } from "react";

import {
  ARCHETYPE_LABELS,
  type ArchetypeLabel,
  type EmotionLabel,
  type TopicLabel,
} from "../../pipeline/config";
import type {
  ChapterSegment,
  Highlight,
  MessageAnnotation,
  Milestone,
  PhraseMotif,
} from "../../pipeline/schemas.js";
import {
  curateHighlights,
  curateMilestones,
  decorateChapters,
  humanizeArchetypeLabel,
} from "@/lib/curation";

const DATA_DIR = path.join(process.cwd(), "data");
const PUBLIC_DIR = path.join(DATA_DIR, "public");
const MESSAGE_ANNOTATIONS_PATH = path.join(DATA_DIR, "annotations", "message_annotations.ndjson");

const LENS_META: Record<
  ArchetypeLabel,
  {
    title: string;
    teaser: string;
    mood: string;
  }
> = {
  "check-in": {
    title: "Check-Ins",
    teaser: "The small 'are you there?' moments that kept us stitched together.",
    mood: "quiet and steady",
  },
  affection: {
    title: "Affection",
    teaser: "The places where love stopped being implied and started glowing.",
    mood: "soft and glowing",
  },
  planning: {
    title: "Planning",
    teaser: "All the little plans that made 'later' feel real.",
    mood: "forward-looking",
  },
  humor_banter: {
    title: "Humor & Banter",
    teaser: "The teasing, play, and nonsense that only made sense between us.",
    mood: "light and spark-filled",
  },
  reassurance: {
    title: "Reassurance",
    teaser: "The messages that held things steady when either of us needed it.",
    mood: "calm and protective",
  },
  conflict: {
    title: "Conflict",
    teaser: "The harder edge of us, when care and friction sat in the same room.",
    mood: "tense and charged",
  },
  repair_reconnection: {
    title: "Repair & Reconnection",
    teaser: "The return after the strain, when reaching back mattered more than being perfect.",
    mood: "tender and fragile",
  },
  longing_missing: {
    title: "Longing & Missing",
    teaser: "The ache, the distance, and the wanting-to-be-closer version of us.",
    mood: "wistful and intimate",
  },
  everyday_life: {
    title: "Everyday Closeness",
    teaser: "The ordinary messages that quietly became a love story.",
    mood: "domestic and lived-in",
  },
  future_imagining: {
    title: "Future Imagining",
    teaser: "The moments where us started sounding like a future, not just a present.",
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
  highlights: ReturnType<typeof curateHighlights>;
  milestones: ReturnType<typeof curateMilestones>;
  chapters: Array<
    ChapterSegment & {
      display_title: string;
      phase_label: string;
      occurrence_index: number;
      lens_count: number;
    }
  >;
  motifs: PhraseMotif[];
};

function readPublicJson<T>(fileName: string): Promise<T> {
  return fs.readFile(path.join(PUBLIC_DIR, fileName), "utf8").then((content) => JSON.parse(content) as T);
}

function lensSlug(archetype: ArchetypeLabel): string {
  return archetype.replace(/_/gu, "-");
}

function lensFromSlug(slug: string): ArchetypeLabel | undefined {
  return ARCHETYPE_LABELS.find((label) => lensSlug(label) === slug);
}

async function readMessageAnnotations(): Promise<{
  totalMessages: number;
  messageToArchetypes: Map<string, ArchetypeLabel[]>;
  lensCounts: Map<ArchetypeLabel, number>;
  emotionCounts: Map<ArchetypeLabel, Map<string, number>>;
  topicCounts: Map<ArchetypeLabel, Map<string, number>>;
}> {
  const messageToArchetypes = new Map<string, ArchetypeLabel[]>();
  const lensCounts = new Map<ArchetypeLabel, number>();
  const emotionCounts = new Map<ArchetypeLabel, Map<string, number>>();
  const topicCounts = new Map<ArchetypeLabel, Map<string, number>>();

  for (const label of ARCHETYPE_LABELS) {
    lensCounts.set(label, 0);
    emotionCounts.set(label, new Map<string, number>());
    topicCounts.set(label, new Map<string, number>());
  }

  let totalMessages = 0;
  const stream = createReadStream(MESSAGE_ANNOTATIONS_PATH, { encoding: "utf8" });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const annotation = JSON.parse(line) as MessageAnnotation;
    totalMessages += 1;
    messageToArchetypes.set(annotation.message_id, annotation.archetype_tags);

    for (const archetype of annotation.archetype_tags) {
      lensCounts.set(archetype, (lensCounts.get(archetype) ?? 0) + 1);

      const emotionBucket = emotionCounts.get(archetype);
      if (emotionBucket) {
        emotionBucket.set(annotation.emotion_label, (emotionBucket.get(annotation.emotion_label) ?? 0) + 1);
      }

      const topicBucket = topicCounts.get(archetype);
      if (topicBucket) {
        for (const topic of annotation.topic_tags) {
          topicBucket.set(topic, (topicBucket.get(topic) ?? 0) + 1);
        }
      }
    }
  }

  return {
    totalMessages,
    messageToArchetypes,
    lensCounts,
    emotionCounts,
    topicCounts,
  };
}

function mapEntriesDescending<T extends string>(value: Map<T, number>, limit: number) {
  return [...value.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export const loadStoryLenses = cache(async (): Promise<StoryLens[]> => {
  const [highlights, milestones, chapters, phraseMotifs, annotationData] = await Promise.all([
    readPublicJson<Highlight[]>("highlights.json"),
    readPublicJson<Milestone[]>("milestones.json"),
    readPublicJson<ChapterSegment[]>("chapter_segments.json"),
    readPublicJson<PhraseMotif[]>("phrase_motifs.json"),
    readMessageAnnotations(),
  ]);

  const decoratedChapters = decorateChapters(chapters);

  return ARCHETYPE_LABELS.map((archetype) => {
    const meta = LENS_META[archetype];
    const relevantHighlights = curateHighlights(
      highlights.filter((highlight) => highlight.archetype_tags.includes(archetype)),
      {
        limit: 5,
        maxChars: 150,
        maxPerChapter: 2,
        maxPerSender: 3,
      },
    );

    const relevantMilestones = curateMilestones(
      milestones.filter((milestone) =>
        milestone.message_ids.some((messageId) => annotationData.messageToArchetypes.get(messageId)?.includes(archetype)),
      ),
      {
        limit: 4,
        maxPerChapter: 2,
        maxSameTitle: 2,
        allowCareerSignals: true,
      },
    );

    const chapterCounts = new Map<string, number>();
    for (const highlight of relevantHighlights) {
      if (highlight.chapter_id) {
        chapterCounts.set(highlight.chapter_id, (chapterCounts.get(highlight.chapter_id) ?? 0) + 1);
      }
    }
    for (const milestone of relevantMilestones) {
      if (milestone.chapter_id) {
        chapterCounts.set(milestone.chapter_id, (chapterCounts.get(milestone.chapter_id) ?? 0) + 2);
      }
    }

    const lensChapters = decoratedChapters
      .filter((chapter) => chapterCounts.has(chapter.chapter_id))
      .map((chapter) => ({
        ...chapter,
        lens_count: chapterCounts.get(chapter.chapter_id) ?? 0,
      }));

    const emotions = mapEntriesDescending(annotationData.emotionCounts.get(archetype) ?? new Map(), 3);
    const topics = mapEntriesDescending(annotationData.topicCounts.get(archetype) ?? new Map(), 4) as Array<{
      label: TopicLabel;
      count: number;
    }>;

    return {
      archetype,
      slug: lensSlug(archetype),
      title: meta.title,
      teaser: meta.teaser,
      mood: meta.mood,
      message_count: annotationData.lensCounts.get(archetype) ?? 0,
      share_of_archive:
        annotationData.totalMessages === 0
          ? 0
          : (annotationData.lensCounts.get(archetype) ?? 0) / annotationData.totalMessages,
      dominant_emotion: (emotions[0]?.label as EmotionLabel | undefined) ?? "neutral",
      top_emotions: emotions,
      top_topics: topics,
      highlights: relevantHighlights,
      milestones: relevantMilestones,
      chapters: lensChapters,
      motifs: phraseMotifs.filter((motif) => motif.archetype_hint === archetype).slice(0, 8),
    };
  }).sort((left, right) => right.message_count - left.message_count);
});

export const loadStoryLens = cache(async (slug: string): Promise<StoryLens | undefined> => {
  const archetype = lensFromSlug(slug);
  if (!archetype) {
    return undefined;
  }

  const allLenses = await loadStoryLenses();
  return allLenses.find((lens) => lens.archetype === archetype);
});

export async function loadTopStoryLenses(limit = 6): Promise<StoryLens[]> {
  const allLenses = await loadStoryLenses();
  return allLenses.slice(0, limit);
}

export function listStoryLensSlugs(): string[] {
  return ARCHETYPE_LABELS.map((label) => lensSlug(label));
}

export function fallbackLensLabel(slug: string): string {
  const archetype = lensFromSlug(slug);
  return archetype ? humanizeArchetypeLabel(archetype) : slug;
}
