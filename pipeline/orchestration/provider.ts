import { ARCHETYPE_LABELS, PROJECT_CONFIG, TOPIC_LABELS } from "../config.js";
import type { CanonicalMessage, ChunkAnnotation, ChunkRecord, MessageAnnotation } from "../schemas.js";

export type AnalysisChunk = {
  chunk: ChunkRecord;
  messages: CanonicalMessage[];
};

export type ChunkAnalysisResult = {
  chunkAnnotation: ChunkAnnotation;
  messageAnnotations: MessageAnnotation[];
};

export interface AnalysisProvider {
  name: string;
  analyzeChunk(input: AnalysisChunk): Promise<ChunkAnalysisResult>;
}

const EMOTION_KEYWORDS = {
  romantic: ["love", "miss you", "cute", "pretty", "jaan", "pyaar", "hug", "kiss", "beautiful"],
  supportive: ["proud", "take care", "good luck", "i am here", "don't worry", "you can", "support"],
  funny: ["haha", "hahaha", "hehe", "lol", "lmao", "pagal", "funny", "joke"],
  conflict: ["angry", "upset", "hurt", "annoyed", "why did", "leave me", "fine then", "not fair"],
  nostalgic: ["remember", "old days", "back then", "first time", "used to", "those days"],
} as const;

const ARCHETYPE_KEYWORDS: Record<string, string[]> = {
  "check-in": ["where are you", "what are you doing", "awake", "home", "reached", "u there"],
  affection: ["love", "miss you", "cute", "pretty", "hug", "kiss", "heart"],
  planning: ["tomorrow", "plan", "schedule", "meet", "trip", "let's", "shall we"],
  humor_banter: ["haha", "hahaha", "hehe", "lol", "joking", "pagal", "stupid", "tease"],
  reassurance: ["don't worry", "it's okay", "i am here", "proud of you", "you can do it"],
  conflict: ["angry", "upset", "hurt", "leave", "not fair", "why did"],
  repair_reconnection: ["sorry", "forgive", "missed you", "glad we're talking", "patch up"],
  longing_missing: ["miss you", "wish you were", "come here", "distance", "want to see you"],
  everyday_life: ["class", "sleep", "food", "lunch", "uni", "office", "work", "home"],
  future_imagining: ["one day", "future", "marry", "together", "our life", "kids"],
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  daily_life: ["sleep", "food", "home", "class", "uni", "office", "today", "busy"],
  future_plans: ["tomorrow", "trip", "plan", "future", "schedule", "meet"],
  relationship: ["us", "together", "relationship", "love", "feelings"],
  humor: ["haha", "hehe", "lol", "joking", "meme"],
  difficult_conversation: ["upset", "hurt", "sorry", "angry", "cry"],
  study_work: ["class", "exam", "assignment", "work", "meeting", "marks"],
  travel: ["trip", "flight", "swat", "kashmir", "travel", "visit"],
  support: ["proud", "good luck", "take care", "support", "i am here"],
  longing: ["miss you", "come here", "wish you were", "distance"],
};

function countMatches(text: string, keywords: readonly string[]): number {
  const normalized = text.toLowerCase();
  return keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueSorted<T extends string>(items: T[]): T[] {
  return [...new Set(items)].sort();
}

function getTopKeys(record: Record<string, number>, limit: number): string[] {
  return Object.entries(record)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label]) => label);
}

class HeuristicAnalysisProvider implements AnalysisProvider {
  name = "heuristic";

  async analyzeChunk(input: AnalysisChunk): Promise<ChunkAnalysisResult> {
    const messageAnnotations = input.messages.map((message) => {
      const loweredText = message.normalized_text;
      const emotionScores = {
        romantic: countMatches(loweredText, EMOTION_KEYWORDS.romantic),
        supportive: countMatches(loweredText, EMOTION_KEYWORDS.supportive),
        funny: countMatches(loweredText, EMOTION_KEYWORDS.funny),
        conflict: countMatches(loweredText, EMOTION_KEYWORDS.conflict),
        nostalgic: countMatches(loweredText, EMOTION_KEYWORDS.nostalgic),
        neutral: 0,
      };
      const dominantEmotion = (getTopKeys(emotionScores, 1)[0] ?? "neutral") as MessageAnnotation["emotion_label"];
      const archetypeTags = uniqueSorted(
        ARCHETYPE_LABELS.filter((label) => countMatches(loweredText, ARCHETYPE_KEYWORDS[label]) > 0),
      );
      const topicTags = uniqueSorted(
        TOPIC_LABELS.filter((label) => countMatches(loweredText, TOPIC_KEYWORDS[label]) > 0),
      );
      const exclamationCount = (message.text.match(/!/gu) ?? []).length;
      const questionCount = (message.text.match(/\?/gu) ?? []).length;
      const uppercaseBoost =
        message.text.length > 4 && message.text === message.text.toUpperCase() ? 0.12 : 0;
      const emotionIntensity = clamp(
        0.15 +
          message.emoji_count * 0.04 +
          exclamationCount * 0.04 +
          questionCount * 0.03 +
          uppercaseBoost +
          (dominantEmotion !== "neutral" ? 0.18 : 0) +
          Math.min(message.word_count, 40) / 140,
        0,
        1,
      );
      const supportSignal = countMatches(loweredText, ["proud", "take care", "good luck", "don't worry"]) > 0;
      const conflictSignal =
        dominantEmotion === "conflict" || archetypeTags.includes("conflict") || loweredText.includes("hurt");
      const repairSignal =
        archetypeTags.includes("repair_reconnection") ||
        countMatches(loweredText, ["sorry", "forgive", "it's okay", "patch up"]) > 0;
      
      const intimacySignal = countMatches(loweredText, ["love", "miss you", "hug", "kiss", "jaan", "babe", "sweetie", "baby", "cute"]);
      const banterSignal = countMatches(loweredText, ["haha", "lmao", "lol", "pagal", "stupid", "joke", "hehe"]);
      const institutionalPenalty = countMatches(loweredText, ["http", "www", "forwarded", "announce", "dear all", "regards", "best,", "event", "deadline", "submit", "linkedin", "please find", "attached"]);

      const importanceScore = clamp(
        0.15 +
          emotionIntensity * 0.45 +
          Math.min(message.word_count, 40) / 120 +
          (supportSignal ? 0.16 : 0) +
          (conflictSignal ? 0.18 : 0) +
          (repairSignal ? 0.18 : 0) +
          (intimacySignal > 0 ? 0.2 : 0) +
          (banterSignal > 0 ? 0.15 : 0) -
          (institutionalPenalty > 0 ? 0.5 : 0) - // Heavy penalty for institutional formats
          (message.word_count > 60 ? 0.3 : 0),   // Heavy penalty for long monologues
        0,
        1,
      );

      return {
        message_id: message.message_id,
        chunk_ids: [input.chunk.chunk_id],
        emotion_label: dominantEmotion,
        emotion_intensity: Number(emotionIntensity.toFixed(4)),
        importance_score: Number(importanceScore.toFixed(4)),
        topic_tags: topicTags.length ? topicTags : ["daily_life"],
        archetype_tags: archetypeTags.length ? archetypeTags : ["everyday_life"],
        highlight_candidate:
          message.message_type === "text" && importanceScore >= 0.67 && message.word_count >= 4 && message.word_count <= 50, // Keep highlights snappy
        milestone_candidate:
          importanceScore >= 0.78 ||
          supportSignal ||
          conflictSignal ||
          repairSignal ||
          archetypeTags.includes("affection"),
        support_signal: supportSignal,
        conflict_signal: conflictSignal,
        repair_signal: repairSignal,
        evidence_score: Number((0.3 + importanceScore * 0.7).toFixed(4)),
        analysis_provider: this.name,
        prompt_version: PROJECT_CONFIG.promptVersion,
      } satisfies MessageAnnotation;
    });

    const dominantEmotions = getTopKeys(
      Object.fromEntries(
        ["romantic", "supportive", "funny", "neutral", "conflict", "nostalgic"].map((emotion) => [
          emotion,
          messageAnnotations.filter((annotation) => annotation.emotion_label === emotion).length,
        ]),
      ),
      3,
    ) as ChunkAnnotation["dominant_emotions"];

    const dominantTopics = getTopKeys(
      Object.fromEntries(
        TOPIC_LABELS.map((topic) => [
          topic,
          messageAnnotations.filter((annotation) => annotation.topic_tags.includes(topic)).length,
        ]),
      ),
      3,
    ) as ChunkAnnotation["dominant_topics"];

    const dominantArchetypes = getTopKeys(
      Object.fromEntries(
        ARCHETYPE_LABELS.map((archetype) => [
          archetype,
          messageAnnotations.filter((annotation) => annotation.archetype_tags.includes(archetype)).length,
        ]),
      ),
      3,
    ) as ChunkAnnotation["dominant_archetypes"];

    const ranked = [...messageAnnotations].sort(
      (left, right) => right.importance_score - left.importance_score,
    );
    const transitions = input.messages
      .slice(1)
      .filter((message, index) => {
        const previous = messageAnnotations[index];
        const current = messageAnnotations[index + 1];
        return (
          previous.emotion_label !== current.emotion_label &&
          (current.importance_score >= 0.7 || previous.importance_score >= 0.7)
        );
      })
      .slice(0, 5)
      .map((message) => message.message_id);

    return {
      chunkAnnotation: {
        chunk_id: input.chunk.chunk_id,
        summary: `Chunk ${input.chunk.chunk_id} leaned ${dominantEmotions[0] ?? "neutral"} with ${dominantArchetypes[0] ?? "everyday_life"} exchanges and ${dominantTopics[0] ?? "daily_life"} themes.`,
        dominant_emotions: dominantEmotions.length ? dominantEmotions : ["neutral"],
        dominant_topics: dominantTopics.length ? dominantTopics : ["daily_life"],
        dominant_archetypes: dominantArchetypes.length ? dominantArchetypes : ["everyday_life"],
        highlight_candidate_message_ids: ranked
          .filter((annotation) => annotation.highlight_candidate)
          .slice(0, 5)
          .map((annotation) => annotation.message_id),
        milestone_candidate_message_ids: ranked
          .filter((annotation) => annotation.milestone_candidate)
          .slice(0, 4)
          .map((annotation) => annotation.message_id),
        segment_transition_message_ids: transitions,
        analysis_provider: this.name,
        prompt_version: PROJECT_CONFIG.promptVersion,
      },
      messageAnnotations,
    };
  }
}

class GeminiAnalysisProvider implements AnalysisProvider {
  name = "gemini";

  async analyzeChunk(): Promise<ChunkAnalysisResult> {
    throw new Error(
      "Gemini live analysis is not configured in this bootstrap. Use RELATIONSHIP_MEMORY_ANALYSIS_PROVIDER=heuristic for local generation.",
    );
  }
}

export function createAnalysisProvider(): AnalysisProvider {
  return PROJECT_CONFIG.analysisProvider === "gemini"
    ? new GeminiAnalysisProvider()
    : new HeuristicAnalysisProvider();
}
