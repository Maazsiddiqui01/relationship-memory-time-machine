import fs from "node:fs";
import path from "node:path";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
const LATE_NIGHT_HOURS: number[] = [22, 23, 0, 1, 2, 3, 4];

function newestTranscriptIn(directory: string): string | null {
  if (!fs.existsSync(directory)) {
    return null;
  }

  const candidates = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
    .map((entry) => {
      const fullPath = path.join(directory, entry.name);
      return {
        fullPath,
        modifiedAt: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.modifiedAt - left.modifiedAt);

  return candidates[0]?.fullPath ?? null;
}

function resolveSourceTranscript(): string {
  const configuredSource = process.env.RELATIONSHIP_MEMORY_SOURCE?.trim();
  if (configuredSource) {
    return path.isAbsolute(configuredSource)
      ? configuredSource
      : path.resolve(ROOT_DIR, configuredSource);
  }

  return (
    newestTranscriptIn(path.join(DATA_DIR, "raw")) ??
    newestTranscriptIn(ROOT_DIR) ??
    path.join(ROOT_DIR, "WhatsApp Chat with Durriya.txt")
  );
}

export const PATHS = {
  rawDir: path.join(DATA_DIR, "raw"),
  canonicalDir: path.join(DATA_DIR, "canonical"),
  annotationsDir: path.join(DATA_DIR, "annotations"),
  derivedDir: path.join(DATA_DIR, "derived"),
  publicDir: path.join(DATA_DIR, "public"),
  publicMessagesDir: path.join(DATA_DIR, "public", "messages"),
  cacheDir: path.join(DATA_DIR, "cache"),
  cacheDb: path.join(DATA_DIR, "cache", "pipeline-cache.sqlite"),
  sourceTranscript: resolveSourceTranscript(),
  canonicalMessages: path.join(DATA_DIR, "canonical", "messages.ndjson"),
  participants: path.join(DATA_DIR, "canonical", "participants.json"),
  sourceManifest: path.join(DATA_DIR, "canonical", "source_manifest.json"),
  messageAnnotations: path.join(DATA_DIR, "annotations", "message_annotations.ndjson"),
  chunkAnnotations: path.join(DATA_DIR, "annotations", "chunk_annotations.ndjson"),
  segmentAnnotations: path.join(DATA_DIR, "annotations", "segment_annotations.ndjson"),
  chunkManifest: path.join(DATA_DIR, "derived", "chunk_manifest.json"),
  technicalSessions: path.join(DATA_DIR, "derived", "technical_sessions.json"),
  narrativeSegments: path.join(DATA_DIR, "derived", "narrative_segments.json"),
  chapterSegments: path.join(DATA_DIR, "derived", "chapter_segments.json"),
  milestones: path.join(DATA_DIR, "derived", "milestones.json"),
  topicClusters: path.join(DATA_DIR, "derived", "topic_clusters.json"),
  phraseMotifs: path.join(DATA_DIR, "derived", "phrase_motifs.json"),
  insideJokes: path.join(DATA_DIR, "derived", "inside_jokes.json"),
  highlights: path.join(DATA_DIR, "derived", "highlights.json"),
  emotionTimeline: path.join(DATA_DIR, "derived", "emotion_timeline.json"),
  messageFrequency: path.join(DATA_DIR, "derived", "message_frequency.json"),
  signatureMetrics: path.join(DATA_DIR, "derived", "signature_metrics.json"),
  dashboardInsights: path.join(DATA_DIR, "derived", "dashboard_insights.json"),
  curatedHomepage: path.join(DATA_DIR, "derived", "curated_homepage.json"),
  memoryBookPayload: path.join(DATA_DIR, "derived", "memory_book_payload.json"),
  storyLenses: path.join(DATA_DIR, "public", "story_lenses.json"),
  messagesManifest: path.join(DATA_DIR, "public", "messages_manifest.json"),
} as const;

export const PROJECT_CONFIG = {
  timezone: process.env.RELATIONSHIP_MEMORY_TIMEZONE ?? "Asia/Riyadh",
  technicalSessionGapMinutes: Number.parseInt(
    process.env.RELATIONSHIP_MEMORY_SESSION_GAP_MINUTES ?? "360",
    10,
  ),
  chunkMessageLimit: Number.parseInt(
    process.env.RELATIONSHIP_MEMORY_CHUNK_SIZE ?? "120",
    10,
  ),
  chunkOverlap: Number.parseInt(process.env.RELATIONSHIP_MEMORY_CHUNK_OVERLAP ?? "15", 10),
  promptVersion: "v1-storytelling-curation",
  analysisProvider: process.env.RELATIONSHIP_MEMORY_ANALYSIS_PROVIDER ?? "heuristic",
  publishedHighlightLimit: 18,
  homepageHighlightLimit: 6,
  homepageMilestoneLimit: 4,
  homepageChapterLimit: 5,
  phaseTargetChapterCount: 6,
  lateNightHours: LATE_NIGHT_HOURS,
} as const;

export const EMOTION_LABELS = [
  "romantic",
  "supportive",
  "funny",
  "neutral",
  "conflict",
  "nostalgic",
] as const;

export const ARCHETYPE_LABELS = [
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

export const TOPIC_LABELS = [
  "daily_life",
  "future_plans",
  "relationship",
  "humor",
  "difficult_conversation",
  "study_work",
  "travel",
  "support",
  "longing",
] as const;

export type EmotionLabel = (typeof EMOTION_LABELS)[number];
export type ArchetypeLabel = (typeof ARCHETYPE_LABELS)[number];
export type TopicLabel = (typeof TOPIC_LABELS)[number];
