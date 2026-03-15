import path from "node:path";

import { PATHS } from "../config.js";
import type {
  CanonicalMessage,
  ChapterSegment,
  MessagesManifest,
  NarrativeSegment,
} from "../schemas.js";
import { ensureProjectDirectories, groupBy, readJson, readNdjson, writeJson } from "../lib/io.js";

async function main(): Promise<void> {
  await ensureProjectDirectories();

  const messages = await readNdjson<CanonicalMessage>(PATHS.canonicalMessages);
  const participants = await readJson(PATHS.participants);
  const narrativeSegments = await readJson<NarrativeSegment[]>(PATHS.narrativeSegments);
  const chapters = await readJson<ChapterSegment[]>(PATHS.chapterSegments);

  const technicalSessionToSegment = new Map<string, string>();
  narrativeSegments.forEach((segment) => {
    segment.technical_session_ids.forEach((technicalSessionId) => {
      technicalSessionToSegment.set(technicalSessionId, segment.narrative_segment_id);
    });
  });
  const segmentToChapter = new Map<string, string>();
  chapters.forEach((chapter) => {
    chapter.narrative_segment_ids.forEach((segmentId) => {
      segmentToChapter.set(segmentId, chapter.chapter_id);
    });
  });

  const monthlyGroups = groupBy(messages, (message) => message.month_key);
  const manifest: MessagesManifest = {
    total_messages: messages.length,
    shard_count: monthlyGroups.size,
    shards: [],
  };

  for (const [monthKey, shardMessages] of [...monthlyGroups.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const shardId = `messages_${monthKey}`;
    const relativePath = `messages/${shardId}.json`;
    manifest.shards.push({
      shard_id: shardId,
      path: relativePath,
      month_key: monthKey,
      message_count: shardMessages.length,
      start_timestamp: shardMessages[0].timestamp_local,
      end_timestamp: shardMessages.at(-1)!.timestamp_local,
    });
    await writeJson(path.join(PATHS.publicDir, relativePath), {
      month_key: monthKey,
      message_count: shardMessages.length,
      messages: shardMessages.map((message) => {
        const narrativeSegmentId = technicalSessionToSegment.get(message.technical_session_id) ?? null;
        return {
          message_id: message.message_id,
          timestamp_local: message.timestamp_local,
          sender_id: message.sender_id,
          sender_label: message.sender_label,
          message_type: message.message_type,
          text: message.text,
          technical_session_id: message.technical_session_id,
          narrative_segment_id: narrativeSegmentId,
          chapter_id: narrativeSegmentId ? segmentToChapter.get(narrativeSegmentId) ?? null : null,
        };
      }),
    });
  }

  await writeJson(PATHS.messagesManifest, manifest);
  await writeJson(path.join(PATHS.publicDir, "participants.json"), participants);

  const passthroughDatasets = [
    ["curated_homepage.json", PATHS.curatedHomepage],
    ["chapter_segments.json", PATHS.chapterSegments],
    ["narrative_segments.json", PATHS.narrativeSegments],
    ["milestones.json", PATHS.milestones],
    ["highlights.json", PATHS.highlights],
    ["topic_clusters.json", PATHS.topicClusters],
    ["phrase_motifs.json", PATHS.phraseMotifs],
    ["inside_jokes.json", PATHS.insideJokes],
    ["emotion_timeline.json", PATHS.emotionTimeline],
    ["message_frequency.json", PATHS.messageFrequency],
    ["signature_metrics.json", PATHS.signatureMetrics],
    ["dashboard_insights.json", PATHS.dashboardInsights],
    ["memory_book_payload.json", PATHS.memoryBookPayload],
  ] as const;

  for (const [fileName, sourcePath] of passthroughDatasets) {
    const payload = await readJson(sourcePath);
    await writeJson(path.join(PATHS.publicDir, fileName), payload);
  }

  console.log(
    JSON.stringify(
      {
        stage: "publish",
        message_shards: manifest.shard_count,
        public_datasets: passthroughDatasets.length + 2,
      },
      null,
      2,
    ),
  );
}

void main();
