import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  ChapterSegment,
  CuratedHomepage,
  DashboardInsights,
  EmotionTimelinePoint,
  Highlight,
  InsideJoke,
  MessageFrequency,
  Milestone,
  PhraseMotif,
  SignatureMetrics,
  TopicCluster,
} from "../../pipeline/schemas.js";

const PUBLIC_DIR = path.join(process.cwd(), "data", "public");
type ParticipantPreview = { participant_id: string; label: string };

async function readDataset<T>(fileName: string): Promise<T> {
  const content = await fs.readFile(path.join(PUBLIC_DIR, fileName), "utf8");
  return JSON.parse(content) as T;
}

export async function loadHomepageData(): Promise<{
  homepage: CuratedHomepage;
  signatureMetrics: SignatureMetrics;
  emotionTimeline: EmotionTimelinePoint[];
  messageFrequency: MessageFrequency;
  highlights: Highlight[];
  milestones: Milestone[];
  chapters: ChapterSegment[];
  participants: Array<{ participant_id: string; label: string }>;
  dashboardInsights: DashboardInsights;
}> {
  const [homepage, signatureMetrics, emotionTimeline, messageFrequency, highlights, milestones, chapters, participants, dashboardInsights] = await Promise.all([
    readDataset<CuratedHomepage>("curated_homepage.json"),
    readDataset<SignatureMetrics>("signature_metrics.json"),
    readDataset<EmotionTimelinePoint[]>("emotion_timeline.json"),
    readDataset<MessageFrequency>("message_frequency.json"),
    readDataset<Highlight[]>("highlights.json"),
    readDataset<Milestone[]>("milestones.json"),
    readDataset<ChapterSegment[]>("chapter_segments.json"),
    readDataset<Array<{ participant_id: string; label: string }>>("participants.json"),
    readDataset<DashboardInsights>("dashboard_insights.json"),
  ]);

  return { homepage, signatureMetrics, emotionTimeline, messageFrequency, highlights, milestones, chapters, participants, dashboardInsights };
}

export async function loadTimelineData(): Promise<{
  chapters: ChapterSegment[];
  milestones: Milestone[];
  participants: ParticipantPreview[];
}> {
  const [chapters, milestones, participants] = await Promise.all([
    readDataset<ChapterSegment[]>("chapter_segments.json"),
    readDataset<Milestone[]>("milestones.json"),
    readDataset<ParticipantPreview[]>("participants.json"),
  ]);
  return { chapters, milestones, participants };
}

export async function loadMomentsData(): Promise<{
  milestones: Milestone[];
  highlights: Highlight[];
  participants: ParticipantPreview[];
}> {
  const [milestones, highlights, participants] = await Promise.all([
    readDataset<Milestone[]>("milestones.json"),
    readDataset<Highlight[]>("highlights.json"),
    readDataset<ParticipantPreview[]>("participants.json"),
  ]);
  return { milestones, highlights, participants };
}

export async function loadThemesData(): Promise<{
  topicClusters: TopicCluster[];
  phraseMotifs: PhraseMotif[];
  insideJokes: InsideJoke[];
}> {
  const [topicClusters, phraseMotifs, insideJokes] = await Promise.all([
    readDataset<TopicCluster[]>("topic_clusters.json"),
    readDataset<PhraseMotif[]>("phrase_motifs.json"),
    readDataset<InsideJoke[]>("inside_jokes.json"),
  ]);
  return { topicClusters, phraseMotifs, insideJokes };
}

export async function loadPatternsData(): Promise<{
  messageFrequency: MessageFrequency;
  signatureMetrics: SignatureMetrics;
  emotionTimeline: EmotionTimelinePoint[];
  dashboardInsights: DashboardInsights;
}> {
  const [messageFrequency, signatureMetrics, emotionTimeline, dashboardInsights] = await Promise.all([
    readDataset<MessageFrequency>("message_frequency.json"),
    readDataset<SignatureMetrics>("signature_metrics.json"),
    readDataset<EmotionTimelinePoint[]>("emotion_timeline.json"),
    readDataset<DashboardInsights>("dashboard_insights.json"),
  ]);
  return { messageFrequency, signatureMetrics, emotionTimeline, dashboardInsights };
}

export async function loadDashboardData(): Promise<{
  dashboardInsights: DashboardInsights;
  signatureMetrics: SignatureMetrics;
  emotionTimeline: EmotionTimelinePoint[];
  messageFrequency: MessageFrequency;
  chapters: ChapterSegment[];
  participants: ParticipantPreview[];
}> {
  const [dashboardInsights, signatureMetrics, emotionTimeline, messageFrequency, chapters, participants] = await Promise.all([
    readDataset<DashboardInsights>("dashboard_insights.json"),
    readDataset<SignatureMetrics>("signature_metrics.json"),
    readDataset<EmotionTimelinePoint[]>("emotion_timeline.json"),
    readDataset<MessageFrequency>("message_frequency.json"),
    readDataset<ChapterSegment[]>("chapter_segments.json"),
    readDataset<ParticipantPreview[]>("participants.json"),
  ]);

  return { dashboardInsights, signatureMetrics, emotionTimeline, messageFrequency, chapters, participants };
}

export async function loadChapterData(slug: string): Promise<{
  chapter: ChapterSegment | undefined;
  highlights: Highlight[];
  milestones: Milestone[];
  participants: ParticipantPreview[];
}> {
  const [chapters, highlights, milestones, participants] = await Promise.all([
    readDataset<ChapterSegment[]>("chapter_segments.json"),
    readDataset<Highlight[]>("highlights.json"),
    readDataset<Milestone[]>("milestones.json"),
    readDataset<ParticipantPreview[]>("participants.json"),
  ]);

  const chapter = chapters.find((entry) => entry.slug === slug);
  return {
    chapter,
    highlights: highlights.filter((highlight) => highlight.chapter_id === chapter?.chapter_id),
    milestones: milestones.filter((milestone) => milestone.chapter_id === chapter?.chapter_id),
    participants,
  };
}

export async function loadAllChapters(): Promise<ChapterSegment[]> {
  return readDataset<ChapterSegment[]>("chapter_segments.json");
}
