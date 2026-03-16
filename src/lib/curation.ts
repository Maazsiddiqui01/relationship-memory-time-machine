import type {
  ChapterSegment,
  Highlight,
  MessageFrequency,
  Milestone,
  TopicCluster,
} from "../../pipeline/schemas.js";

const BROADCAST_PATTERNS = [
  /\bhi everyone\b/iu,
  /congratulations to you and your team/iu,
  /\bteam\b/iu,
  /\bhr\b/iu,
  /\bta\b/iu,
  /assessment center/iu,
  /presentation round/iu,
  /meeting link/iu,
  /microsoft teams/iu,
  /\bjury\b/iu,
  /\bportal\b/iu,
  /\bslides\b/iu,
  /\bsemester\b/iu,
  /\bstudents?\b/iu,
  /\btestimonial\b/iu,
  /\buniversity\b/iu,
  /\bcandidates?\b/iu,
  /\bfeedback\b/iu,
  /\bprocess\b/iu,
  /\bround\b/iu,
  /\bdear\b/iu,
  /\bregards\b/iu,
  /good luck with your presentation/iu,
  /downloaded on your device/iu,
  /\bassignment\b/iu,
  /\bdeadline\b/iu,
  /\bexam(?:s)?\b/iu,
  /\bquiz\b/iu,
  /\bproject\b/iu,
  /\bsubmission\b/iu,
];

const RELATIONAL_PATTERNS = [
  /\blove\b/iu,
  /\bmiss\b/iu,
  /\bproud\b/iu,
  /\bbaby\b/iu,
  /\bjaan\b/iu,
  /\bhabibi\b/iu,
  /\bhabibti\b/iu,
  /\bmeri jaan\b/iu,
  /\bmy love\b/iu,
  /\bsorry\b/iu,
  /\btogether\b/iu,
  /\bheart\b/iu,
  /\bhug\b/iu,
  /\bkiss\b/iu,
  /\bcare\b/iu,
  /\bhere for you\b/iu,
  /\bi am here\b/iu,
];

const CAREER_PATTERNS = [
  /\bjob\b/iu,
  /\bintern(ship)?\b/iu,
  /\bcareer\b/iu,
  /\bcorporate\b/iu,
  /\bfinance trainee\b/iu,
  /\bgsk\b/iu,
  /\bloreal\b/iu,
  /\bbrandstorm\b/iu,
  /\bpresentation\b/iu,
  /\brecruit(ment|ing)?\b/iu,
  /\boffer\b/iu,
  /\boffice\b/iu,
];

const SOFT_MOJIBAKE_PATTERNS = [/Ã/gu, /â€¦/gu, /â€”/gu, /â€¢/gu, /ðŸ/gu, /Ù/gu];
const GENERIC_CHAPTER_SUMMARY = /leans .* shaping the phase\./iu;

const ARCHETYPE_COPY: Record<string, string> = {
  check_in: "gentle check-ins",
  affection: "overt affection",
  planning: "shared plans",
  humor_banter: "playful banter",
  reassurance: "mutual reassurance",
  conflict: "moments of friction",
  repair_reconnection: "repair and reconnection",
  longing_missing: "missing each other",
  everyday_life: "everyday closeness",
  future_imagining: "future-facing talk",
};

const EMOTION_COPY: Record<string, string> = {
  romantic: "romantic",
  supportive: "supportive",
  funny: "light",
  conflict: "tense",
  nostalgic: "nostalgic",
  neutral: "steady",
};

const CHAPTER_SUFFIXES = ["Revisited", "Later", "Again", "Afterward"];

type DisplayChapter = ChapterSegment & {
  display_title: string;
  phase_label: string;
  occurrence_index: number;
};

export type CuratedHighlight = Highlight & {
  excerpt: string;
  display_quote: string;
  quality_score: number;
};

export type CuratedMilestone = Milestone & {
  display_title: string;
  short_summary: string;
  display_quote: string | null;
  quality_score: number;
};

export type MonthlyVolumePoint = {
  month_key: string;
  count: number;
};

const TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/â€¢/gu, " / "],
  [/â€“|â€”/gu, "-"],
  [/â€¦/gu, "..."],
  [/â€œ|â€/gu, "\""],
  [/â€˜|â€™/gu, "'"],
  [/â€”/gu, "-"],
  [/â€“/gu, "-"],
  [/â€¦/gu, "..."],
  [/â€¢/gu, " * "],
  [/â€œ|â€/gu, "\""],
  [/â€˜|â€™/gu, "'"],
  [/Ã¢â€ â€™/gu, "->"],
  [/Ã¢â€ Â/gu, "<-"],
  [/Ã¢â‚¬Â¢/gu, " * "],
  [/Ã¢â‚¬â€/gu, "-"],
  [/Â·/gu, " / "],
  [/Â/gu, ""],
];

export function cleanDisplayText(value: string): string {
  return TEXT_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s+/gu, " ")
    .replace(/^"+|"+$/gu, "")
    .trim();
}

export function buildExcerpt(value: string, maxChars = 160): string {
  const cleaned = cleanDisplayText(value);
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, Math.max(lastSpace, maxChars - 18)).trim()}...`;
}

function countPatternHits(value: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(value) ? count + 1 : count), 0);
}

function hasListLikeDensity(value: string): boolean {
  return (
    (value.match(/[:;]/gu)?.length ?? 0) >= 4 ||
    (value.match(/\b-\s/gu)?.length ?? 0) >= 3 ||
    (value.match(/\n/gu)?.length ?? 0) >= 4
  );
}

export function humanizeArchetypeLabel(value: string): string {
  return value.replace(/_/gu, " ");
}

function hasCareerSignal(value: string): boolean {
  return countPatternHits(cleanDisplayText(value), CAREER_PATTERNS) > 0;
}

function hasBirthdaySignal(value: string): boolean {
  return /\bbirthday\b/iu.test(value);
}

function hasFutureSignal(value: string): boolean {
  return /\bmarry\b|\bnikkah\b|\bfamily\b|\bfuture\b|\bwait for you\b/iu.test(value);
}

export function isLowValueText(value: string): boolean {
  const cleaned = cleanDisplayText(value);
  const wordCount = cleaned.split(/\s+/u).filter(Boolean).length;
  const broadcastHits = countPatternHits(cleaned, BROADCAST_PATTERNS);
  const relationalHits = countPatternHits(cleaned, RELATIONAL_PATTERNS);
  const mojibakeHits = countPatternHits(cleaned, SOFT_MOJIBAKE_PATTERNS);

  if (broadcastHits >= 2) {
    return true;
  }
  if (broadcastHits >= 1 && relationalHits === 0 && !hasCareerSignal(cleaned)) {
    return true;
  }
  if (wordCount > 60 && relationalHits < 2 && !hasCareerSignal(cleaned)) {
    return true;
  }
  if (wordCount > 100 && relationalHits < 3) {
    return true;
  }
  if (hasListLikeDensity(cleaned) && relationalHits < 2) {
    return true;
  }
  if (mojibakeHits >= 4 && wordCount > 35) {
    return true;
  }
  if ((cleaned.match(/https?:\/\//gu)?.length ?? 0) >= 1 && relationalHits === 0) {
    return true;
  }
  if ((cleaned.match(/[!?]/gu)?.length ?? 0) > 10 && wordCount > 50 && relationalHits < 2) {
    return true;
  }

  return false;
}

function highlightQualityScore(highlight: Highlight): number {
  const cleaned = cleanDisplayText(highlight.quote);
  const wordCount = cleaned.split(/\s+/u).filter(Boolean).length;
  let score = highlight.importance_score * 100;

  if (isLowValueText(cleaned)) {
    score -= 80;
  }
  if (highlight.archetype_tags.includes("affection")) {
    score += 22;
  }
  if (highlight.archetype_tags.includes("repair_reconnection")) {
    score += 18;
  }
  if (highlight.archetype_tags.includes("reassurance")) {
    score += 16;
  }
  if (highlight.archetype_tags.includes("humor_banter")) {
    score += 12;
  }
  if (highlight.emotion_label === "romantic" || highlight.emotion_label === "supportive") {
    score += 14;
  }
  if (highlight.emotion_label === "funny") {
    score += 8;
  }
  if (cleaned.length >= 25 && cleaned.length <= 160) {
    score += 20;
  }
  if (wordCount > 35) {
    score -= 25;
  }
  if (cleaned.length > 200) {
    score -= 30;
  }
  if (wordCount < 4) {
    score -= 20;
  }

  return score;
}

function buildMilestoneDisplayTitle(milestone: Milestone): string {
  const text = cleanDisplayText(
    `${milestone.title} ${milestone.summary} ${milestone.representative_quote}`,
  ).toLowerCase();

  if (hasBirthdaySignal(text)) {
    return "Birthday Love Note";
  }
  if (hasCareerSignal(text)) {
    return "Career Step";
  }
  if (hasFutureSignal(text)) {
    return "Future on the Line";
  }
  if (/\bforgive\b|\bsorry\b|\bapolog/iu.test(text) && milestone.milestone_type === "repair") {
    return "Repair Attempt";
  }
  if (/\bproud\b|\bexam\b|\bpresentation\b|\binterview\b|\bgood luck\b|\bace\b/iu.test(text)) {
    return "Cheering From The Sidelines";
  }
  if (/\bdistance\b|\bspace\b|\blet's actually ensure\b|\bpull away\b/iu.test(text)) {
    return "Pulling Away";
  }
  if (milestone.milestone_type === "repair") {
    return "Return to Warmth";
  }
  if (milestone.milestone_type === "support") {
    return "Support in Motion";
  }
  if (milestone.milestone_type === "conflict") {
    return "A Hard Conversation";
  }
  if (milestone.milestone_type === "future") {
    return "Looking Ahead";
  }

  return cleanDisplayText(milestone.title);
}

function milestoneQualityScore(milestone: Milestone): number {
  let score = milestone.importance_score * 100;

  if (milestone.milestone_type === "repair" || milestone.milestone_type === "support") {
    score += 18;
  }
  if (milestone.milestone_type === "affection" || milestone.milestone_type === "future") {
    score += 12;
  }
  if (hasCareerSignal(milestone.representative_quote)) {
    score += 16;
  }
  if (isLowValueText(milestone.representative_quote) && !hasCareerSignal(milestone.representative_quote)) {
    score -= 70;
  }

  return score;
}

function formatMilestoneDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMilestoneMonth(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function buildMilestoneSummary(milestone: Milestone, displayTitle: string): string {
  const formattedDate = formatMilestoneDate(milestone.start_timestamp);

  if (displayTitle === "Career Step") {
    return `A career step that mattered to both of you around ${formattedDate}.`;
  }
  if (displayTitle === "Birthday Love Note") {
    return `A birthday note that carried more than just the day around ${formattedDate}.`;
  }
  if (displayTitle === "Future on the Line") {
    return `One of the moments where "later" started sounding real around ${formattedDate}.`;
  }
  if (displayTitle === "Repair Attempt" || displayTitle === "Return to Warmth") {
    return `A softer return after strain around ${formattedDate}.`;
  }
  if (displayTitle === "Cheering From The Sidelines" || displayTitle === "Support in Motion") {
    return `A moment of clear support around ${formattedDate}.`;
  }
  if (displayTitle === "A Hard Conversation" || displayTitle === "Pulling Away") {
    return `A harder turn that changed the mood around ${formattedDate}.`;
  }

  return buildExcerpt(milestone.summary, 130);
}

function buildMilestoneDisplayQuote(milestone: Milestone): string | null {
  const cleaned = cleanDisplayText(milestone.representative_quote);
  const wordCount = cleaned.split(/\s+/u).filter(Boolean).length;
  const relationalHits = countPatternHits(cleaned, RELATIONAL_PATTERNS);
  const supportSignal = /\bproud\b|\bcongratulations\b|\byou did it\b|\bgot in\b|\bgot it\b|\boffer\b|\bso happy for you\b/iu.test(
    cleaned,
  );

  if (!cleaned) {
    return null;
  }
  if (isLowValueText(cleaned) && !hasCareerSignal(cleaned)) {
    return null;
  }
  if (wordCount > 26) {
    return null;
  }
  if (relationalHits === 0 && !supportSignal) {
    return null;
  }

  return buildExcerpt(cleaned, 96);
}

export function curateHighlights(
  highlights: Highlight[],
  options?: {
    limit?: number;
    maxChars?: number;
    maxPerChapter?: number;
    maxPerSender?: number;
  },
): CuratedHighlight[] {
  const limit = options?.limit ?? 12;
  const maxChars = options?.maxChars ?? 170;
  const maxPerChapter = options?.maxPerChapter ?? 2;
  const maxPerSender = options?.maxPerSender ?? 2;
  const selected: CuratedHighlight[] = [];
  const chapterCounts = new Map<string, number>();
  const senderCounts = new Map<string, number>();
  const seenExcerpts = new Set<string>();

  const ranked = highlights
    .map((highlight) => ({
      ...highlight,
      quality_score: highlightQualityScore(highlight),
      excerpt: buildExcerpt(highlight.quote, maxChars),
      display_quote: cleanDisplayText(highlight.quote),
    }))
    .filter((highlight) => !isLowValueText(highlight.quote))
    .filter((highlight) => highlight.quality_score > 20)
    .sort((left, right) => right.quality_score - left.quality_score);

  for (const highlight of ranked) {
    const chapterId = highlight.chapter_id ?? "unassigned";
    const currentChapterCount = chapterCounts.get(chapterId) ?? 0;
    const senderKey = highlight.sender_label ?? highlight.sender_id ?? "system";
    const currentSenderCount = senderCounts.get(senderKey) ?? 0;

    if (currentChapterCount >= maxPerChapter) {
      continue;
    }
    if (currentSenderCount >= maxPerSender) {
      continue;
    }
    if (seenExcerpts.has(highlight.excerpt)) {
      continue;
    }

    seenExcerpts.add(highlight.excerpt);
    chapterCounts.set(chapterId, currentChapterCount + 1);
    senderCounts.set(senderKey, currentSenderCount + 1);
    selected.push(highlight);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function curateMilestones(
  milestones: Milestone[],
  options?: {
    limit?: number;
    maxPerChapter?: number;
    maxSameTitle?: number;
    allowCareerSignals?: boolean;
  },
): CuratedMilestone[] {
  const limit = options?.limit ?? 8;
  const maxPerChapter = options?.maxPerChapter ?? 2;
  const maxSameTitle = options?.maxSameTitle ?? 1;
  const allowCareerSignals = options?.allowCareerSignals ?? false;
  const selected: CuratedMilestone[] = [];
  const chapterCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();

  const ranked = milestones
    .map((milestone) => {
      const displayTitle = buildMilestoneDisplayTitle(milestone);
      return {
        ...milestone,
        display_title: displayTitle,
        short_summary: buildMilestoneSummary(milestone, displayTitle),
        display_quote: buildMilestoneDisplayQuote(milestone),
        quality_score: milestoneQualityScore(milestone),
      };
    })
    .filter(
      (milestone) =>
        !isLowValueText(milestone.representative_quote) ||
        (allowCareerSignals && hasCareerSignal(milestone.representative_quote)),
    )
    .filter((milestone) => milestone.quality_score > 10)
    .sort((left, right) => right.quality_score - left.quality_score);

  for (const milestone of ranked) {
    const chapterId = milestone.chapter_id ?? "unassigned";
    const currentChapterCount = chapterCounts.get(chapterId) ?? 0;
    const titleKey = milestone.display_title.trim().toLowerCase();
    const currentTitleCount = titleCounts.get(titleKey) ?? 0;

    if (currentChapterCount >= maxPerChapter) {
      continue;
    }
    if (currentTitleCount >= maxSameTitle) {
      continue;
    }

    chapterCounts.set(chapterId, currentChapterCount + 1);
    titleCounts.set(titleKey, currentTitleCount + 1);
    selected.push(milestone);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function decorateChapters(chapters: ChapterSegment[]): DisplayChapter[] {
  const seenTitles = new Map<string, number>();

  return chapters.map((chapter, index) => {
    const occurrenceIndex = (seenTitles.get(chapter.title) ?? 0) + 1;
    seenTitles.set(chapter.title, occurrenceIndex);

    const suffix = occurrenceIndex > 1 ? CHAPTER_SUFFIXES[Math.min(occurrenceIndex - 2, CHAPTER_SUFFIXES.length - 1)] : "";
    const displayTitle = suffix ? `${chapter.title}: ${suffix}` : chapter.title;

    return {
      ...chapter,
      display_title: displayTitle,
      phase_label: `Phase ${index + 1}`,
      occurrence_index: occurrenceIndex,
    };
  });
}

export function decorateRepeatedTitles<T extends { title: string }>(
  items: T[],
): Array<T & { display_title: string; occurrence_index: number }> {
  const seenTitles = new Map<string, number>();

  return items.map((item) => {
    const occurrenceIndex = (seenTitles.get(item.title) ?? 0) + 1;
    seenTitles.set(item.title, occurrenceIndex);

    const suffix = occurrenceIndex > 1 ? CHAPTER_SUFFIXES[Math.min(occurrenceIndex - 2, CHAPTER_SUFFIXES.length - 1)] : "";
    const displayTitle = suffix ? `${item.title}: ${suffix}` : item.title;

    return {
      ...item,
      display_title: displayTitle,
      occurrence_index: occurrenceIndex,
    };
  });
}

export function differentiateMilestoneTitles<T extends { display_title: string; start_timestamp: string }>(milestones: T[]): T[] {
  const titleCounts = milestones.reduce((counts, milestone) => {
    const key = milestone.display_title.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return milestones.map((milestone) => {
    const key = milestone.display_title.trim().toLowerCase();
    if ((titleCounts.get(key) ?? 0) < 2) {
      return milestone;
    }

    return {
      ...milestone,
      display_title: `${milestone.display_title} • ${formatMilestoneMonth(milestone.start_timestamp)}`,
    };
  });
}

export function summarizeChapter(
  chapter: ChapterSegment & { display_title?: string; occurrence_index?: number },
): string {
  const title = cleanDisplayText(chapter.display_title ?? chapter.title).toLowerCase();
  const occurrenceIndex = chapter.occurrence_index ?? 1;

  if (title.includes("everyday gravity")) {
    return occurrenceIndex > 1
      ? "The familiar rhythm was still able to feel new."
      : "This was the part where the rhythm started to feel natural, steady, and full of care.";
  }

  if (title.includes("ordinary days")) {
    return occurrenceIndex > 1
      ? "By then, even the ordinary days carried their own softness."
      : "Comfort and play started living side by side here, easy and unforced.";
  }

  if (title.includes("shared routine")) {
    return occurrenceIndex > 1
      ? "Routine stopped feeling ordinary here; it started feeling settled."
      : "This was the phase where the routine started carrying more warmth and meaning.";
  }

  if (!GENERIC_CHAPTER_SUMMARY.test(chapter.summary)) {
    return buildExcerpt(chapter.summary, 110);
  }

  const emotion = EMOTION_COPY[chapter.dominant_emotion] ?? chapter.dominant_emotion;
  const archetypes = chapter.dominant_archetypes
    .slice(0, 2)
    .map((label) => ARCHETYPE_COPY[label] ?? label.replace(/_/gu, " "));

  if (!archetypes.length) {
    return `A ${emotion} stretch with its own rhythm and quiet turning points.`;
  }
  if (archetypes.length === 1) {
    return `A ${emotion} stretch carried by ${archetypes[0]}.`;
  }

  return `A ${emotion} stretch full of ${archetypes[0]} and ${archetypes[1]}.`;
}

export function getMonthlyVolume(messageFrequency: MessageFrequency): MonthlyVolumePoint[] {
  const counts = new Map<string, number>();

  for (const day of messageFrequency.daily_counts) {
    const monthKey = day.day_key.slice(0, 7);
    counts.set(monthKey, (counts.get(monthKey) ?? 0) + day.count);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([month_key, count]) => ({
      month_key,
      count,
    }));
}

export function curateTopicClusters(topicClusters: TopicCluster[], limit = 6): TopicCluster[] {
  return topicClusters
    .filter((cluster) => cluster.count > 20 && !isLowValueText(cluster.representative_quotes.join(" ")))
    .slice(0, limit);
}
