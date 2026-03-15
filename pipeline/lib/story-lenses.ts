import { ARCHETYPE_LABELS, type ArchetypeLabel, type EmotionLabel, type TopicLabel } from "../config.js";
import type {
  ChapterSegment,
  Highlight,
  MessageAnnotation,
  Milestone,
  PhraseMotif,
} from "../schemas.js";
import { readJson, readNdjson, writeJson } from "./io.js";
import { PATHS } from "../config.js";
import { curateHighlights, curateMilestones, decorateChapters } from "../../src/lib/curation.js";
import { LENS_META, lensSlug, type StoryLens } from "../../src/lib/story-lens-shared.js";

function mapEntriesDescending<T extends string>(value: Map<T, number>, limit: number) {
  return [...value.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

async function readMessageAnnotations(): Promise<{
  totalMessages: number;
  messageToArchetypes: Map<string, ArchetypeLabel[]>;
  lensCounts: Map<ArchetypeLabel, number>;
  emotionCounts: Map<ArchetypeLabel, Map<string, number>>;
  topicCounts: Map<ArchetypeLabel, Map<string, number>>;
}> {
  const rows = await readNdjson<MessageAnnotation>(PATHS.messageAnnotations);
  const messageToArchetypes = new Map<string, ArchetypeLabel[]>();
  const lensCounts = new Map<ArchetypeLabel, number>();
  const emotionCounts = new Map<ArchetypeLabel, Map<string, number>>();
  const topicCounts = new Map<ArchetypeLabel, Map<string, number>>();

  for (const label of ARCHETYPE_LABELS) {
    lensCounts.set(label, 0);
    emotionCounts.set(label, new Map<string, number>());
    topicCounts.set(label, new Map<string, number>());
  }

  for (const annotation of rows) {
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
    totalMessages: rows.length,
    messageToArchetypes,
    lensCounts,
    emotionCounts,
    topicCounts,
  };
}

export async function buildStoryLenses(): Promise<StoryLens[]> {
  const [highlights, milestones, chapters, phraseMotifs, annotationData] = await Promise.all([
    readJson<Highlight[]>(PATHS.highlights),
    readJson<Milestone[]>(PATHS.milestones),
    readJson<ChapterSegment[]>(PATHS.chapterSegments),
    readJson<PhraseMotif[]>(PATHS.phraseMotifs),
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
    } satisfies StoryLens;
  }).sort((left, right) => right.message_count - left.message_count);
}

export async function writeStoryLenses(): Promise<void> {
  const storyLenses = await buildStoryLenses();
  await writeJson(PATHS.storyLenses, storyLenses);
}
