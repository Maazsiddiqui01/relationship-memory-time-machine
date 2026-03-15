import { format } from "date-fns";

import { PATHS, PROJECT_CONFIG, type ArchetypeLabel } from "../config.js";
import {
  DashboardInsightsSchema,
  ChapterSegmentSchema,
  HighlightSchema,
  InsideJokeSchema,
  MilestoneSchema,
  NarrativeSegmentSchema,
  SegmentAnnotationSchema,
  TechnicalSessionSummarySchema,
  TopicClusterSchema,
  type CanonicalMessage,
  type ChapterSegment,
  type Highlight,
  type MessageAnnotation,
  type Milestone,
  type NarrativeSegment,
  type Participant,
  type PhraseMotif,
  type SegmentAnnotation,
  type TopicCluster,
} from "../schemas.js";
import { readJson, readNdjson, writeJson, writeNdjson } from "../lib/io.js";
import { slugify, titleCase } from "../lib/text.js";
import {
  buildDashboardInsights,
  buildEmotionTimeline,
  buildMessageFrequency,
  buildNarrativeSegments,
  buildPhraseMotifCandidates,
  buildSignatureMetrics,
  buildTechnicalSessionSummaries,
} from "../exec/deterministic.js";

function buildMessageLookup(messages: CanonicalMessage[]): Map<string, CanonicalMessage> {
  return new Map(messages.map((message) => [message.message_id, message]));
}

function buildChapterTitle(index: number, dominantArchetype: string): string {
  const titlesByArchetype: Record<string, string[]> = {
    affection: ["Early Warmth", "Closer Orbit", "Tender Gravity"],
    planning: ["Plans Taking Shape", "Future Notes", "Shared Trajectory"],
    humor_banter: ["Laughter Season", "Playful Momentum", "Banter in Bloom"],
    reassurance: ["Holding Steady", "Quiet Support", "Soft Ground"],
    conflict: ["The Tense Stretch", "Fracture Lines", "Hard Conversations"],
    repair_reconnection: ["Finding the Way Back", "Mending Together", "Repair and Return"],
    longing_missing: ["Distance and Pull", "Missing Each Other", "Longing in Motion"],
    future_imagining: ["Looking Ahead", "Future Shape", "Dreaming Forward"],
    "check-in": ["Small Openings", "Daily Signals", "Checking In"],
    everyday_life: ["Everyday Gravity", "Ordinary Days, Real Closeness", "Shared Routine"],
  };

  const choices = titlesByArchetype[dominantArchetype] ?? ["Another Turn", "A New Phase", "Shared Time"];
  return choices[index % choices.length];
}

function buildChapters(
  segments: NarrativeSegment[],
): { chapters: ChapterSegment[]; segmentToChapter: Map<string, string> } {
  const segmentToChapter = new Map<string, string>();
  const totalMessages = segments.reduce((sum, segment) => sum + segment.message_count, 0);
  const targetChapters = Math.max(
    1,
    Math.min(PROJECT_CONFIG.phaseTargetChapterCount, segments.length),
  );
  const targetPerChapter = Math.max(1, Math.ceil(totalMessages / targetChapters));
  const chapters: ChapterSegment[] = [];
  let currentSegments: NarrativeSegment[] = [];
  let runningMessages = 0;

  const flush = (): void => {
    if (!currentSegments.length) {
      return;
    }

    const chapterIndex = chapters.length + 1;
    const dominantEmotion = currentSegments
      .map((segment) => segment.dominant_emotion)
      .sort(
        (left, right) =>
          currentSegments.filter((segment) => segment.dominant_emotion === right).length -
          currentSegments.filter((segment) => segment.dominant_emotion === left).length,
      )[0];
    const dominantTopics = [...new Set(currentSegments.flatMap((segment) => segment.dominant_topics))].slice(0, 3);
    const dominantArchetypes = [...new Set(currentSegments.flatMap((segment) => segment.dominant_archetypes))].slice(0, 3);
    const title = buildChapterTitle(chapterIndex - 1, dominantArchetypes[0] ?? "everyday_life");
    const chapter: ChapterSegment = {
      chapter_id: `chapter_${String(chapterIndex).padStart(3, "0")}`,
      slug: `chapter-${String(chapterIndex).padStart(2, "0")}-${slugify(title)}`,
      title,
      summary: `${title} leans ${dominantEmotion} with ${titleCase(
        dominantArchetypes[0] ?? "everyday_life",
      )} and ${titleCase(dominantTopics[0] ?? "daily_life")} shaping the phase.`,
      start_timestamp: currentSegments[0].start_timestamp,
      end_timestamp: currentSegments.at(-1)!.end_timestamp,
      narrative_segment_ids: currentSegments.map((segment) => segment.narrative_segment_id),
      milestone_ids: [],
      highlight_ids: [],
      dominant_emotion: dominantEmotion,
      dominant_topics: dominantTopics.length ? dominantTopics : ["daily_life"],
      dominant_archetypes: dominantArchetypes.length ? dominantArchetypes : ["everyday_life"],
      message_count: currentSegments.reduce((sum, segment) => sum + segment.message_count, 0),
    };

    for (const segment of currentSegments) {
      segmentToChapter.set(segment.narrative_segment_id, chapter.chapter_id);
    }

    chapters.push(chapter);
    currentSegments = [];
    runningMessages = 0;
  };

  segments.forEach((segment, index) => {
    currentSegments.push(segment);
    runningMessages += segment.message_count;
    const remainingSegments = segments.length - index - 1;
    const remainingChapters = targetChapters - chapters.length - 1;
    const shouldFlush =
      runningMessages >= targetPerChapter &&
      (remainingSegments >= remainingChapters || remainingChapters <= 0);

    if (shouldFlush) {
      flush();
    }
  });

  flush();

  return {
    chapters: chapters.map((chapter) => ChapterSegmentSchema.parse(chapter)),
    segmentToChapter,
  };
}

function buildHighlights(params: {
  messages: CanonicalMessage[];
  annotations: Map<string, MessageAnnotation>;
  messageToSegment: Map<string, string>;
  segmentToChapter: Map<string, string>;
}): Highlight[] {
  const { messages, annotations, messageToSegment, segmentToChapter } = params;
  const seenQuotes = new Set<string>();
  const highlights: Highlight[] = [];

  const rankedMessages = messages
    .filter((message) => message.message_type === "text")
    .map((message) => ({
      message,
      annotation: annotations.get(message.message_id),
    }))
    .filter(
      (entry): entry is { message: CanonicalMessage; annotation: MessageAnnotation } =>
        Boolean(entry.annotation?.highlight_candidate),
    )
    .sort((left, right) => right.annotation.importance_score - left.annotation.importance_score);

  for (const entry of rankedMessages) {
    const normalizedQuote = entry.message.normalized_text;
    if (seenQuotes.has(normalizedQuote)) {
      continue;
    }
    seenQuotes.add(normalizedQuote);
    const narrativeSegmentId = messageToSegment.get(entry.message.message_id) ?? null;
    const chapterId = narrativeSegmentId ? segmentToChapter.get(narrativeSegmentId) ?? null : null;
    highlights.push(
      HighlightSchema.parse({
        highlight_id: `highlight_${String(highlights.length + 1).padStart(4, "0")}`,
        message_id: entry.message.message_id,
        timestamp_local: entry.message.timestamp_local,
        sender_id: entry.message.sender_id,
        sender_label: entry.message.sender_label,
        quote: entry.message.text,
        emotion_label: entry.annotation.emotion_label,
        archetype_tags: entry.annotation.archetype_tags,
        topic_tags: entry.annotation.topic_tags,
        importance_score: entry.annotation.importance_score,
        narrative_segment_id: narrativeSegmentId,
        chapter_id: chapterId,
      }),
    );

    if (highlights.length >= 60) {
      break;
    }
  }

  return highlights;
}

function buildMilestones(params: {
  messages: CanonicalMessage[];
  annotations: Map<string, MessageAnnotation>;
  messageToSegment: Map<string, string>;
  segmentToChapter: Map<string, string>;
}): Milestone[] {
  const { messages, annotations, messageToSegment, segmentToChapter } = params;
  const bySegment = new Set<string>();
  const milestones: Milestone[] = [];

  const ranked = messages
    .filter((message) => message.message_type === "text")
    .map((message) => ({
      message,
      annotation: annotations.get(message.message_id),
    }))
    .filter(
      (entry): entry is { message: CanonicalMessage; annotation: MessageAnnotation } =>
        Boolean(entry.annotation?.milestone_candidate),
    )
    .sort((left, right) => right.annotation.importance_score - left.annotation.importance_score);

  for (const entry of ranked) {
    const segmentId = messageToSegment.get(entry.message.message_id) ?? "segment_unknown";
    if (bySegment.has(segmentId)) {
      continue;
    }

    bySegment.add(segmentId);
    const milestoneType = entry.annotation.repair_signal
      ? "repair"
      : entry.annotation.conflict_signal
        ? "conflict"
        : entry.annotation.support_signal
          ? "support"
          : entry.annotation.archetype_tags.includes("affection")
            ? "affection"
            : entry.annotation.archetype_tags.includes("future_imagining")
              ? "future"
              : "turning_point";

    const title =
      milestoneType === "repair"
        ? "A Return to Warmth"
        : milestoneType === "conflict"
          ? "A Tense Exchange"
          : milestoneType === "support"
            ? "A Strong Support Moment"
            : milestoneType === "affection"
              ? "A Tender Moment"
              : milestoneType === "future"
                ? "Looking Forward Together"
                : "A Shift in the Story";

    milestones.push(
      MilestoneSchema.parse({
        milestone_id: `milestone_${String(milestones.length + 1).padStart(4, "0")}`,
        milestone_type: milestoneType,
        title,
        summary: `${title} around ${format(new Date(entry.message.timestamp_local), "MMM d, yyyy")} with ${entry.annotation.emotion_label} tone and ${titleCase(entry.annotation.archetype_tags[0])} energy.`,
        start_timestamp: entry.message.timestamp_local,
        end_timestamp: entry.message.timestamp_local,
        message_ids: [entry.message.message_id],
        representative_quote: entry.message.text,
        narrative_segment_id: segmentId === "segment_unknown" ? null : segmentId,
        chapter_id: segmentToChapter.get(segmentId) ?? null,
        importance_score: entry.annotation.importance_score,
      }),
    );

    if (milestones.length >= 24) {
      break;
    }
  }

  return milestones;
}

function buildTopicClusters(
  messages: CanonicalMessage[],
  annotations: Map<string, MessageAnnotation>,
): TopicCluster[] {
  const clusters = new Map<string, { count: number; messages: CanonicalMessage[] }>();

  for (const message of messages) {
    const annotation = annotations.get(message.message_id);
    if (!annotation) {
      continue;
    }
    for (const topic of annotation.topic_tags) {
      const current = clusters.get(topic) ?? { count: 0, messages: [] };
      current.count += 1;
      current.messages.push(message);
      clusters.set(topic, current);
    }
  }

  return [...clusters.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .map(([label, cluster], index) =>
      TopicClusterSchema.parse({
        topic_id: `topic_${String(index + 1).padStart(4, "0")}`,
        label,
        count: cluster.count,
        representative_message_ids: cluster.messages.slice(0, 8).map((message) => message.message_id),
        representative_quotes: cluster.messages.slice(0, 5).map((message) => message.text),
      }),
    );
}

function buildPhraseMotifs(
  motifCandidates: PhraseMotif[],
  annotations: Map<string, MessageAnnotation>,
): PhraseMotif[] {
  return motifCandidates.map((candidate) => {
    const archetypeVotes = candidate.representative_message_ids
      .map((messageId) => annotations.get(messageId)?.archetype_tags[0])
      .filter((label): label is ArchetypeLabel => Boolean(label));
    const archetypeHint = archetypeVotes[0] ?? null;
    return {
      ...candidate,
      archetype_hint: archetypeHint,
    };
  });
}

async function main(): Promise<void> {
  const messages = await readNdjson<CanonicalMessage>(PATHS.canonicalMessages);
  const participants = await readJson<Participant[]>(PATHS.participants);
  const messageAnnotations = await readNdjson<MessageAnnotation>(PATHS.messageAnnotations);
  const annotationMap = new Map(messageAnnotations.map((annotation) => [annotation.message_id, annotation]));
  const messageLookup = buildMessageLookup(messages);
  const technicalSessions = buildTechnicalSessionSummaries(messages, annotationMap).map((session) =>
    TechnicalSessionSummarySchema.parse(session),
  );
  const narrativeSegments = buildNarrativeSegments(technicalSessions, messageLookup).map((segment) =>
    NarrativeSegmentSchema.parse(segment),
  );
  const technicalSessionToSegment = new Map<string, string>();
  for (const segment of narrativeSegments) {
    for (const technicalSessionId of segment.technical_session_ids) {
      technicalSessionToSegment.set(technicalSessionId, segment.narrative_segment_id);
    }
  }
  const messageToSegment = new Map<string, string>();
  for (const message of messages) {
    const segmentId = technicalSessionToSegment.get(message.technical_session_id);
    if (segmentId) {
      messageToSegment.set(message.message_id, segmentId);
    }
  }

  const { chapters, segmentToChapter } = buildChapters(narrativeSegments);
  const highlights = buildHighlights({
    messages,
    annotations: annotationMap,
    messageToSegment,
    segmentToChapter,
  });
  const milestones = buildMilestones({
    messages,
    annotations: annotationMap,
    messageToSegment,
    segmentToChapter,
  });
  const chaptersWithLinks = chapters.map((chapter) =>
    ChapterSegmentSchema.parse({
      ...chapter,
      highlight_ids: highlights
        .filter((highlight) => highlight.chapter_id === chapter.chapter_id)
        .slice(0, 8)
        .map((highlight) => highlight.highlight_id),
      milestone_ids: milestones
        .filter((milestone) => milestone.chapter_id === chapter.chapter_id)
        .slice(0, 5)
        .map((milestone) => milestone.milestone_id),
    }),
  );
  const segmentAnnotations = narrativeSegments.map((segment) =>
    SegmentAnnotationSchema.parse({
      narrative_segment_id: segment.narrative_segment_id,
      summary: segment.summary,
      dominant_tone: segment.dominant_emotion,
      dominant_topics: segment.dominant_topics,
      dominant_archetypes: segment.dominant_archetypes,
      turning_point: segment.turning_point,
      conflict_repair_cycle: segment.conflict_repair_cycle,
    } satisfies SegmentAnnotation),
  );
  const topicClusters = buildTopicClusters(messages, annotationMap);
  const phraseMotifs = buildPhraseMotifs(buildPhraseMotifCandidates(messages), annotationMap);
  const insideJokes = phraseMotifs
    .filter((motif) => motif.count >= 4 && motif.archetype_hint === "humor_banter")
    .slice(0, 18)
    .map((motif, index) =>
      InsideJokeSchema.parse({
        inside_joke_id: `inside_joke_${String(index + 1).padStart(4, "0")}`,
        label: motif.label,
        count: motif.count,
        representative_message_ids: motif.representative_message_ids,
        summary: `A recurring playful motif that appears ${motif.count} times across the conversation.`,
      }),
    );
  const emotionTimeline = buildEmotionTimeline(messages, annotationMap);
  const messageFrequency = buildMessageFrequency(messages);
  const signatureMetrics = buildSignatureMetrics({
    messages,
    participants,
    annotations: annotationMap,
    technicalSessions,
    chapters: chaptersWithLinks,
  });
  const dashboardInsights = DashboardInsightsSchema.parse(
    buildDashboardInsights({
      messages,
      participants,
      annotations: annotationMap,
      technicalSessions,
      chapters: chaptersWithLinks,
    }),
  );

  await writeJson(PATHS.technicalSessions, technicalSessions);
  await writeJson(PATHS.narrativeSegments, narrativeSegments);
  await writeNdjson(PATHS.segmentAnnotations, segmentAnnotations);
  await writeJson(PATHS.chapterSegments, chaptersWithLinks);
  await writeJson(PATHS.highlights, highlights);
  await writeJson(PATHS.milestones, milestones);
  await writeJson(PATHS.topicClusters, topicClusters);
  await writeJson(PATHS.phraseMotifs, phraseMotifs);
  await writeJson(PATHS.insideJokes, insideJokes);
  await writeJson(PATHS.emotionTimeline, emotionTimeline);
  await writeJson(PATHS.messageFrequency, messageFrequency);
  await writeJson(PATHS.signatureMetrics, signatureMetrics);
  await writeJson(PATHS.dashboardInsights, dashboardInsights);

  console.log(
    JSON.stringify(
      {
        stage: "consolidate",
        technical_sessions: technicalSessions.length,
        narrative_segments: narrativeSegments.length,
        chapters: chaptersWithLinks.length,
        highlights: highlights.length,
        milestones: milestones.length,
        dashboard_records: dashboardInsights.detective_records.length,
      },
      null,
      2,
    ),
  );
}

void main();
