import { PROJECT_CONFIG, PATHS } from "../config.js";
import { ChunkAnnotationSchema, ChunkSchema, MessageAnnotationSchema, type CanonicalMessage, type ChunkRecord, type MessageAnnotation } from "../schemas.js";
import { createContentHash, ensureProjectDirectories, readNdjson, writeJson, writeNdjson } from "../lib/io.js";
import { PipelineCache } from "./cache.js";
import { createAnalysisProvider, type AnalysisChunk, type ChunkAnalysisResult } from "./provider.js";

function buildChunks(messages: CanonicalMessage[]): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];
  let chunkIndex = 0;
  let cursor = 0;

  while (cursor < messages.length) {
    const start = cursor;
    const endExclusive = Math.min(messages.length, start + PROJECT_CONFIG.chunkMessageLimit);
    const slice = messages.slice(start, endExclusive);
    const chunkHash = createContentHash(
      JSON.stringify(
        slice.map((message) => ({
          message_id: message.message_id,
          text: message.normalized_text,
        })),
      ),
    );
    chunkIndex += 1;
    chunks.push(
      ChunkSchema.parse({
        chunk_id: `chunk_${String(chunkIndex).padStart(5, "0")}`,
        chunk_index: chunkIndex - 1,
        chunk_hash: chunkHash,
        technical_session_ids: [...new Set(slice.map((message) => message.technical_session_id))],
        start_message_id: slice[0].message_id,
        end_message_id: slice.at(-1)!.message_id,
        start_timestamp: slice[0].timestamp_local,
        end_timestamp: slice.at(-1)!.timestamp_local,
        message_ids: slice.map((message) => message.message_id),
      }),
    );

    if (endExclusive >= messages.length) {
      break;
    }

    cursor = Math.max(endExclusive - PROJECT_CONFIG.chunkOverlap, start + 1);
  }

  return chunks;
}

type AnnotationAccumulator = MessageAnnotation & {
  observations: number;
};

function mergeAnnotations(results: ChunkAnalysisResult[]): MessageAnnotation[] {
  const map = new Map<string, AnnotationAccumulator>();

  for (const result of results) {
    for (const annotation of result.messageAnnotations) {
      const existing = map.get(annotation.message_id);
      if (!existing) {
        map.set(annotation.message_id, { ...annotation, observations: 1 });
        continue;
      }

      existing.chunk_ids = [...new Set([...existing.chunk_ids, ...annotation.chunk_ids])];
      existing.emotion_intensity = Number(
        ((existing.emotion_intensity * existing.observations + annotation.emotion_intensity) /
          (existing.observations + 1)).toFixed(4),
      );
      existing.importance_score = Number(
        ((existing.importance_score * existing.observations + annotation.importance_score) /
          (existing.observations + 1)).toFixed(4),
      );
      existing.evidence_score = Number(
        ((existing.evidence_score * existing.observations + annotation.evidence_score) /
          (existing.observations + 1)).toFixed(4),
      );
      existing.topic_tags = [...new Set([...existing.topic_tags, ...annotation.topic_tags])];
      existing.archetype_tags = [...new Set([...existing.archetype_tags, ...annotation.archetype_tags])];
      if (annotation.importance_score >= existing.importance_score) {
        existing.emotion_label = annotation.emotion_label;
      }
      existing.highlight_candidate ||= annotation.highlight_candidate;
      existing.milestone_candidate ||= annotation.milestone_candidate;
      existing.support_signal ||= annotation.support_signal;
      existing.conflict_signal ||= annotation.conflict_signal;
      existing.repair_signal ||= annotation.repair_signal;
      existing.observations += 1;
    }
  }

  return [...map.values()]
    .map(({ observations: _observations, ...annotation }) => MessageAnnotationSchema.parse(annotation))
    .sort((left, right) => left.message_id.localeCompare(right.message_id));
}

async function main(): Promise<void> {
  await ensureProjectDirectories();
  const messages = await readNdjson<CanonicalMessage>(PATHS.canonicalMessages);
  const messageLookup = new Map(messages.map((message) => [message.message_id, message]));
  const chunks = buildChunks(messages);
  const provider = createAnalysisProvider();
  const cache = new PipelineCache();
  const chunkResults: ChunkAnalysisResult[] = [];

  try {
    for (const chunk of chunks) {
      const cached = cache.get(chunk.chunk_hash, provider.name);
      if (cached) {
        chunkResults.push(cached);
        continue;
      }

      const chunkMessages = chunk.message_ids
        .map((messageId) => messageLookup.get(messageId))
        .filter((message): message is CanonicalMessage => Boolean(message));
      const result = await provider.analyzeChunk({
        chunk,
        messages: chunkMessages,
      } satisfies AnalysisChunk);
      const validated = {
        chunkAnnotation: ChunkAnnotationSchema.parse(result.chunkAnnotation),
        messageAnnotations: result.messageAnnotations.map((annotation) =>
          MessageAnnotationSchema.parse(annotation),
        ),
      };
      cache.set(chunk.chunk_hash, provider.name, validated);
      chunkResults.push(validated);
    }
  } finally {
    cache.close();
  }

  const mergedAnnotations = mergeAnnotations(chunkResults);
  await writeJson(PATHS.chunkManifest, chunks);
  await writeNdjson(
    PATHS.chunkAnnotations,
    chunkResults.map((result) => result.chunkAnnotation),
  );
  await writeNdjson(PATHS.messageAnnotations, mergedAnnotations);

  console.log(
    JSON.stringify(
      {
        stage: "analyze",
        provider: provider.name,
        prompt_version: PROJECT_CONFIG.promptVersion,
        chunk_count: chunks.length,
        message_annotation_count: mergedAnnotations.length,
      },
      null,
      2,
    ),
  );
}

void main();
