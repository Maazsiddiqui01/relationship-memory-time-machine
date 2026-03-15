import { format } from "date-fns";

import { PATHS, PROJECT_CONFIG } from "../config.js";
import {
  CuratedHomepageSchema,
  type ChapterSegment,
  type CuratedHomepage,
  type EmotionTimelinePoint,
  type Highlight,
  type Milestone,
  type SignatureMetrics,
} from "../schemas.js";
import { readJson, writeJson } from "../lib/io.js";

function pickDiverseHighlights(highlights: Highlight[]): Highlight[] {
  // Pre-filter: strictly discard long monologues and low-importance from homepage candidates
  const candidates = highlights.filter(
    (h) => h.importance_score > 0.65 && h.quote.length >= 10 && h.quote.length <= 250 // Roughly 40 words 
  );

  // Sort candidates by emotional impact and importance
  const sorted = [...candidates].sort((a, b) => {
    // Boost specific intimate/fun emotions
    const aBoost = ["romantic", "funny", "supportive"].includes(a.emotion_label) ? 0.3 : 0;
    const bBoost = ["romantic", "funny", "supportive"].includes(b.emotion_label) ? 0.3 : 0;
    return (b.importance_score + bBoost) - (a.importance_score + aBoost);
  });

  const selected: Highlight[] = [];
  const usedChapters = new Set<string>();
  const usedEmotions = new Set<string>();

  for (const highlight of sorted) {
    const chapterOkay = !highlight.chapter_id || !usedChapters.has(highlight.chapter_id) || selected.length >= 4;
    const emotionOkay = !usedEmotions.has(highlight.emotion_label) || selected.length >= 4;
    
    // Additional strictness for the first few slots: force diversity
    if (!chapterOkay || !emotionOkay) {
      continue;
    }

    selected.push(highlight);
    if (highlight.chapter_id) {
      usedChapters.add(highlight.chapter_id);
    }
    usedEmotions.add(highlight.emotion_label);

    if (selected.length >= PROJECT_CONFIG.homepageHighlightLimit) {
      break;
    }
  }

  return selected;
}

function summarizeArc(points: EmotionTimelinePoint[]) {
  if (!points.length) {
    return {
      opening_tone: "neutral",
      midpoint_tone: "neutral",
      closing_tone: "neutral",
      peak_period: "N/A",
    } as CuratedHomepage["emotional_arc_summary"];
  }

  const midpoint = points[Math.floor(points.length / 2)];
  const peak = [...points].sort((left, right) => right.average_intensity - left.average_intensity)[0];
  return {
    opening_tone: points[0].dominant_emotion,
    midpoint_tone: midpoint.dominant_emotion,
    closing_tone: points.at(-1)!.dominant_emotion,
    peak_period: peak.period_label,
  } satisfies CuratedHomepage["emotional_arc_summary"];
}

async function main(): Promise<void> {
  const chapters = await readJson<ChapterSegment[]>(PATHS.chapterSegments);
  const highlights = await readJson<Highlight[]>(PATHS.highlights);
  const milestones = await readJson<Milestone[]>(PATHS.milestones);
  const emotionTimeline = await readJson<EmotionTimelinePoint[]>(PATHS.emotionTimeline);
  const signatureMetrics = await readJson<SignatureMetrics>(PATHS.signatureMetrics);
  const participants = await readJson<{ participant_id: string; label: string }[]>(PATHS.participants);

  const firstChapter = chapters[0];
  const lastChapter = chapters.at(-1);
  const curatedHomepage = CuratedHomepageSchema.parse({
    generated_at: new Date().toISOString(),
    intro: {
      title: "Relationship Memory Time Machine",
      subtitle: `A curated journey through ${participants.map((participant) => participant.label).join(" and ")} across messages, moods, and milestones.`,
      time_span:
        firstChapter && lastChapter
          ? `${format(new Date(firstChapter.start_timestamp), "MMM yyyy")} to ${format(new Date(lastChapter.end_timestamp), "MMM yyyy")}`
          : "Conversation timeline",
    },
    headline_metrics: signatureMetrics.story_spotlights.slice(0, 4),
    selected_highlights: pickDiverseHighlights(highlights),
    milestone_previews: milestones.slice(0, PROJECT_CONFIG.homepageMilestoneLimit),
    chapter_previews: chapters.slice(0, PROJECT_CONFIG.homepageChapterLimit),
    emotional_arc_summary: summarizeArc(emotionTimeline),
    signature_spotlights: signatureMetrics.story_spotlights.slice(0, 4),
  });

  const memoryBookPayload = {
    generated_at: new Date().toISOString(),
    title: "Relationship Memory Book",
    intro: curatedHomepage.intro,
    chapters: chapters.map((chapter) => ({
      chapter_id: chapter.chapter_id,
      title: chapter.title,
      summary: chapter.summary,
      start_timestamp: chapter.start_timestamp,
      end_timestamp: chapter.end_timestamp,
      dominant_emotion: chapter.dominant_emotion,
      milestone_previews: milestones.filter((milestone) => milestone.chapter_id === chapter.chapter_id).slice(0, 4),
      highlight_previews: highlights.filter((highlight) => highlight.chapter_id === chapter.chapter_id).slice(0, 6),
    })),
  };

  await writeJson(PATHS.curatedHomepage, curatedHomepage);
  await writeJson(PATHS.memoryBookPayload, memoryBookPayload);

  console.log(
    JSON.stringify(
      {
        stage: "curate",
        selected_highlights: curatedHomepage.selected_highlights.length,
        milestone_previews: curatedHomepage.milestone_previews.length,
        chapter_previews: curatedHomepage.chapter_previews.length,
      },
      null,
      2,
    ),
  );
}

void main();
