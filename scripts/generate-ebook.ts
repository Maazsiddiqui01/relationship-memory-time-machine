import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { ARCHETYPE_LABELS, type ArchetypeLabel } from "../pipeline/config.js";
import type {
  ChapterSegment,
  EmotionTimelinePoint,
  Highlight,
  MessageFrequency,
  Milestone,
  Participant,
  PhraseMotif,
  SignatureMetrics,
  TopicCluster,
} from "../pipeline/schemas.js";
import {
  buildExcerpt,
  cleanDisplayText,
  curateHighlights,
  curateMilestones,
  curateTopicClusters,
  decorateChapters,
  getMonthlyVolume,
  humanizeArchetypeLabel,
  summarizeChapter,
} from "../src/lib/curation.js";
import { formatCompact, formatIsoDate, formatMonthYear } from "../src/lib/format.js";
import { deriveProjectProfile } from "../src/lib/project-profile.js";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "output", "pdf");
const GENERATED_IMAGE_DIR = path.join(ROOT_DIR, "output", "imagegen");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "ebook-manifest.json");
const IMAGE_DIR = path.join(ROOT_DIR, "public", "images");
const DATA_DIR = path.join(ROOT_DIR, "data", "public");
const MESSAGE_ANNOTATIONS_PATH = path.join(ROOT_DIR, "data", "annotations", "message_annotations.ndjson");

const ARCHETYPE_META: Record<
  ArchetypeLabel,
  {
    title: string;
    mood: string;
  }
> = {
  "check-in": { title: "Check-Ins", mood: "quiet anchoring" },
  affection: { title: "Affection", mood: "soft and glowing" },
  planning: { title: "Planning", mood: "future-facing" },
  humor_banter: { title: "Humor & Banter", mood: "spark and play" },
  reassurance: { title: "Reassurance", mood: "calm holding" },
  conflict: { title: "Conflict", mood: "pressure and honesty" },
  repair_reconnection: { title: "Repair", mood: "fragile return" },
  longing_missing: { title: "Longing", mood: "distance and ache" },
  everyday_life: { title: "Everyday Closeness", mood: "lived-in warmth" },
  future_imagining: { title: "Future Imagining", mood: "cinematic hope" },
};

type DecoratedChapter = ReturnType<typeof decorateChapters>[number];
type BookMilestone = ReturnType<typeof curateMilestones>[number];
type BookHighlight = ReturnType<typeof curateHighlights>[number];

type BookMetric = {
  label: string;
  value: string;
  detail: string;
};

type BookLens = {
  archetype: ArchetypeLabel;
  title: string;
  mood: string;
  count: number;
  share: number;
};

type BookChapter = DecoratedChapter & {
  curated_summary: string;
  milestone: BookMilestone | null;
  highlight: BookHighlight | null;
};

type BookPayload = {
  slug: string;
  presentation_mode: "gift" | "archive";
  title: string;
  subtitle: string;
  tagline: string;
  participants: string[];
  time_span: string;
  cover_image: string;
  chapter_image: string;
  lens_image: string;
  headline_metrics: BookMetric[];
  reply_gap_metrics: Array<{ label: string; value: string }>;
  emotional_arc: EmotionTimelinePoint[];
  monthly_volume: Array<{ month_key: string; count: number }>;
  message_frequency: MessageFrequency;
  chapters: BookChapter[];
  milestones: BookMilestone[];
  highlights: BookHighlight[];
  topics: TopicCluster[];
  motifs: PhraseMotif[];
  lenses: BookLens[];
  signature_metrics: SignatureMetrics;
  closing_quote: BookHighlight | null;
  keepsake_line: string;
};

type EbookManifest = {
  slug: string;
  title: string;
  html_path: string;
  json_path: string;
  pdf_path: string;
  generated_at: string;
};

function readPublicJson<T>(fileName: string): Promise<T> {
  return fs.readFile(path.join(DATA_DIR, fileName), "utf8").then((content) => JSON.parse(content) as T);
}

async function embedImageFromPath(fullPath: string): Promise<string> {
  const extension = path.extname(fullPath).slice(1).toLowerCase();
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
  const buffer = await fs.readFile(fullPath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function embedImage(fileName: string): Promise<string> {
  return embedImageFromPath(path.join(IMAGE_DIR, fileName));
}

async function embedPreferredImage(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      try {
        await fs.access(candidate);
        return embedImageFromPath(candidate);
      } catch {
        continue;
      }
    }

    const generated = path.join(GENERATED_IMAGE_DIR, candidate);
    try {
      await fs.access(generated);
      return embedImageFromPath(generated);
    } catch {
      continue;
    }

    const publicImage = path.join(IMAGE_DIR, candidate);
    try {
      await fs.access(publicImage);
      return embedImageFromPath(publicImage);
    } catch {
      continue;
    }
  }

  throw new Error(`No image candidate found for ${candidates.join(", ")}`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "conversation-memory-book";
}

function createAreaChart(points: EmotionTimelinePoint[], width: number, height: number): string {
  const margin = { top: 40, right: 0, bottom: 40, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const intensityValues = points.map(p => p.average_intensity);
  const minIntensity = Math.min(...intensityValues);
  const maxIntensity = Math.max(...intensityValues);
  const intensityRange = Math.max(0.01, maxIntensity - minIntensity);

  const coordinates = points.map((point, index) => {
    const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
    // Normalize intensity so min is at bottom and max is at top
    const normalizedY = (point.average_intensity - minIntensity) / intensityRange;
    const y = margin.top + (1 - normalizedY) * innerHeight;
    return { x, y, label: point.period_label, count: point.message_count };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${margin.left + innerWidth} ${margin.top + innerHeight} L ${margin.left} ${margin.top + innerHeight} Z`;

  const labels = coordinates
    .filter((_, index) => index % Math.max(1, Math.floor(points.length / 5)) === 0 || index === points.length - 1)
    .map(
      (point) => `
        <g>
          <text x="${point.x.toFixed(1)}" y="${height - 5}" text-anchor="middle" font-size="7pt" letter-spacing="0.1em" style="text-transform:uppercase;opacity:0.6;">${escapeHtml(point.label.slice(0, 7))}</text>
        </g>
      `,
    )
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Emotional arc chart">
      <defs>
        <linearGradient id="ebookEmotionFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#d88da5" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#d88da5" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#ebookEmotionFill)" stroke="none"></path>
      <path d="${linePath}" fill="none" stroke="#b96b84" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;"></path>
      ${labels}
    </svg>
  `;
}

function createMonthlyBarChart(points: Array<{ month_key: string; count: number }>, width: number, height: number): string {
  const margin = { top: 20, right: 0, bottom: 30, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(...points.map((point) => point.count), 1);
  const barWidth = innerWidth / Math.max(points.length, 1);

  const bars = points
    .map((point, index) => {
      const barHeight = (point.count / maxCount) * innerHeight;
      const x = margin.left + index * barWidth + barWidth * 0.15;
      const y = margin.top + innerHeight - barHeight;
      const showLabel = index % Math.max(1, Math.floor(points.length / 5)) === 0 || index === points.length - 1;
      const centerX = x + (barWidth * 0.7) / 2;
      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barWidth * 0.7).toFixed(1)}" height="${barHeight.toFixed(1)}" rx="4" fill="var(--rose-deep)" style="opacity:0.4;" />
          ${showLabel ? `<text x="${centerX.toFixed(1)}" y="${height - 2}" text-anchor="middle" font-size="7pt" style="text-transform:uppercase;opacity:0.6;letter-spacing:0.05em;">${escapeHtml(point.month_key.slice(2))}</text>` : ""}
        </g>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Monthly volume chart">
      <line x1="0" y1="${margin.top + innerHeight}" x2="${width}" y2="${margin.top + innerHeight}" stroke="var(--line)" />
      ${bars}
    </svg>
  `;
}

function createHeatmapSvg(messageFrequency: MessageFrequency, width: number): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const gridX = 40;
  const gridY = 30;
  const cell = 14;
  const gap = 3;
  const bins = messageFrequency.heatmap_bins;
  const max = Math.max(...bins.map((bin) => bin.count), 1);
  const height = gridY + 7 * (cell + gap) + 10;

  const labels = weekdays
    .map(
      (day, index) => `<text x="0" y="${gridY + index * (cell + gap) + cell * 0.75}" class="heatmap-axis" font-size="7pt" style="text-transform:uppercase;opacity:0.6;">${day}</text>`,
    )
    .join("");

  const hourLabels = [0, 4, 8, 12, 16, 20, 23]
    .map((hour) => {
      const x = gridX + hour * (cell + gap);
      return `<text x="${x + cell / 2}" y="15" class="heatmap-axis" text-anchor="middle" font-size="7pt" style="text-transform:uppercase;opacity:0.6;">${hour}h</text>`;
    })
    .join("");

  const cells = bins
    .map((bin) => {
      const x = gridX + bin.hour_of_day * (cell + gap);
      const y = gridY + bin.weekday * (cell + gap);
      const strength = Math.max(0.08, bin.count / max);
      return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="var(--rose-deep)" style="opacity:${strength.toFixed(2)};" />`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Conversation heatmap">
      ${hourLabels}
      ${labels}
      ${cells}
    </svg>
  `;
}

function createChapterTimeline(chapters: BookChapter[], width: number, height: number): string {
  const margin = { top: 40, right: 0, bottom: 20, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const rowHeight = 44;
  const trackHeight = 10;
  const starts = chapters.map((chapter) => new Date(chapter.start_timestamp).getTime());
  const ends = chapters.map((chapter) => new Date(chapter.end_timestamp).getTime());
  const min = Math.min(...starts);
  const max = Math.max(...ends);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Chapter timeline">
      ${chapters
        .map((chapter, index) => {
          const start = new Date(chapter.start_timestamp).getTime();
          const end = new Date(chapter.end_timestamp).getTime();
          const x = margin.left + ((start - min) / Math.max(max - min, 1)) * innerWidth;
          const barWidth = Math.max(30, ((end - start) / Math.max(max - min, 1)) * innerWidth);
          const y = margin.top + index * rowHeight;
          return `
            <g>
              <text x="0" y="${y - 12}" font-family="Montserrat" font-weight="700" font-size="7pt" letter-spacing="0.1em" style="text-transform:uppercase;opacity:0.6;">${escapeHtml(chapter.phase_label)}</text>
              <rect x="${x.toFixed(1)}" y="${y}" width="${barWidth.toFixed(1)}" height="${trackHeight}" rx="5" fill="var(--rose-deep)" style="opacity:0.2;" />
              <text x="${x.toFixed(1)}" y="${y + trackHeight + 15}" font-family="Playfair Display" font-size="9pt">${escapeHtml(chapter.display_title)}</text>
            </g>
          `;
        })
        .join("")}
    </svg>
  `;
}

function createLateNightGauge(value: number, size = 220): string {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - value / 100);
  const center = size / 2;

  return `
    <svg viewBox="0 0 ${size} ${size}" class="gauge-svg" aria-label="Late night share">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--line)" stroke-width="8" />
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius}"
        fill="none"
        stroke="var(--rose-deep)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${strokeOffset.toFixed(2)}"
        transform="rotate(-90 ${center} ${center})"
        style="opacity:0.8;"
      />
      <text x="${center}" y="${center - 5}" text-anchor="middle" class="gauge-value" fill="var(--ink)">${escapeHtml(formatPercent(value))}</text>
      <text x="${center}" y="${center + 25}" text-anchor="middle" class="gauge-label">late-night</text>
    </svg>
  `;
}

function createLensGarden(lenses: BookLens[], width: number, height: number): string {
  const maxCount = Math.max(...lenses.map((lens) => lens.count), 1);
  const positions = [
    { x: 120, y: 140 },
    { x: 300, y: 100 },
    { x: 480, y: 140 },
    { x: 180, y: 280 },
    { x: 360, y: 280 },
    { x: 540, y: 230 },
  ];

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Archetype garden">
      ${lenses
        .slice(0, positions.length)
        .map((lens, index) => {
          const position = positions[index];
          const radius = 50 + (lens.count / maxCount) * 40;
          return `
            <g>
              <circle cx="${position.x}" cy="${position.y}" r="${radius.toFixed(1)}" fill="var(--rose-deep)" style="opacity:0.06;" />
              <text x="${position.x}" y="${position.y - 5}" text-anchor="middle" class="lens-value" fill="var(--ink)">${escapeHtml(formatCompact(lens.count))}</text>
              <text x="${position.x}" y="${position.y + 16}" text-anchor="middle" class="lens-name" fill="var(--rose-deep)">${escapeHtml(lens.title)}</text>
            </g>
          `;
        })
        .join("")}
    </svg>
  `;
}

function buildMilestoneAtlas(milestones: BookMilestone[]): string {
  const sorted = [...milestones].sort((left, right) => left.start_timestamp.localeCompare(right.start_timestamp));
  return sorted
    .map(
      (milestone, index) => `
        <article class="atlas-card ${index % 3 === 0 ? "atlas-card--accent" : ""}">
          <div class="atlas-date">${escapeHtml(formatIsoDate(milestone.start_timestamp))}</div>
          <h3>${escapeHtml(milestone.display_title)}</h3>
          <p>${escapeHtml(milestone.short_summary)}</p>
        </article>
      `,
    )
    .join("");
}

function buildChapterPages(chapters: BookChapter[], chapterImage: string): string {
  return chapters
    .map((chapter, index) => {
      const milestoneLabel = chapter.milestone ? chapter.milestone.display_title : "The feeling kept deepening";
      const milestoneDetail = chapter.milestone
        ? buildExcerpt(chapter.milestone.short_summary, 92)
        : "No single turning point, just the pattern gradually taking on a clearer shape.";
      const quote = chapter.highlight ? chapter.highlight.excerpt : "A phase that stayed warm long after it passed.";

      return `
        <section class="page page--chapter">
          <img class="page-art page-art--chapter" src="${chapterImage}" alt="" />
          <div class="page-number">${index + 7}</div>
          <div class="page-chapter-grid" style="margin-top: 15mm; flex-grow: 1;">
            <div class="chapter-copy">
              <span class="eyebrow">${escapeHtml(chapter.phase_label)}</span>
              <h2>${escapeHtml(chapter.display_title)}</h2>
              <p class="chapter-summary" style="margin-top: 6mm; font-size: 10.5pt; max-width: 85mm;">${escapeHtml(chapter.curated_summary)}</p>
              
              <div class="chapter-stats" style="margin-top: 10mm; border-top: 1px solid var(--line); padding-top: 6mm;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 3mm;">
                  <span style="font-size: 7pt; letter-spacing: 0.15em; text-transform: uppercase;">Volume</span>
                  <strong style="font-family: 'Playfair Display', serif; font-size: 16pt;">${escapeHtml(formatCompact(chapter.message_count))}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 3mm;">
                  <span style="font-size: 7pt; letter-spacing: 0.15em; text-transform: uppercase;">Mood</span>
                  <strong style="font-family: 'Playfair Display', serif; font-size: 14pt;">${escapeHtml(chapter.dominant_emotion)}</strong>
                </div>
              </div>
            </div>
            
            <div class="chapter-side" style="display: flex; flex-direction: column; justify-content: flex-end; gap: 8mm;">
              <article class="chapter-note" style="border-left: 2px solid var(--rose-deep); padding-left: 5mm;">
                <h3 style="font-size: 14pt;">${escapeHtml(milestoneLabel)}</h3>
                <p style="font-style: italic; opacity: 0.8; font-size: 10pt;">${escapeHtml(milestoneDetail)}</p>
              </article>
              <article class="chapter-quote-card" style="background: rgba(255, 255, 255, 0.4); padding: 6mm; border-radius: 4px; border: 1px solid var(--line);">
                <blockquote style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 14pt; line-height: 1.3;">
                  &ldquo;${escapeHtml(quote)}&rdquo;
                </blockquote>
              </article>
            </div>
          </div>
        </section>
      `;
    })
    .join("");
}

async function computeLensCounts(): Promise<BookLens[]> {
  const archetypeCounts = new Map<ArchetypeLabel, number>();
  let total = 0;

  for (const archetype of ARCHETYPE_LABELS) {
    archetypeCounts.set(archetype, 0);
  }

  const stream = createReadStream(MESSAGE_ANNOTATIONS_PATH, { encoding: "utf8" });
  const lines = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const parsed = JSON.parse(line) as { archetype_tags: ArchetypeLabel[] };
    total += 1;

    for (const archetype of parsed.archetype_tags) {
      archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
    }
  }

  return [...archetypeCounts.entries()]
    .map(([archetype, count]) => ({
      archetype,
      title: ARCHETYPE_META[archetype]?.title ?? humanizeArchetypeLabel(archetype),
      mood: ARCHETYPE_META[archetype]?.mood ?? "story signal",
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function pickTopicMotifs(topicClusters: TopicCluster[], phraseMotifs: PhraseMotif[]) {
  const topics = curateTopicClusters(topicClusters, 6);
  const motifs = phraseMotifs
    .filter((motif) => motif.count >= 20)
    .filter((motif) => motif.label.split(/\s+/u).length <= 5)
    .slice(0, 10);
  return { topics, motifs };
}

function personalizeChapterSummary(chapter: DecoratedChapter, index: number): string {
  const title = chapter.display_title.toLowerCase();

  if (title.includes("everyday gravity")) {
    return index < 3
      ? "This was the part where the rhythm started to feel natural, steady, and full of care."
      : "The rhythm was familiar by then, but it still knew how to feel new.";
  }

  if (title.includes("ordinary days")) {
    return index < 3
      ? "Comfort and play started living side by side here, easy and unforced."
      : "By this point, even the ordinary days carried their own softness.";
  }

  if (title.includes("shared routine")) {
    return index < 3
      ? "This was the phase where the routine started carrying more warmth."
      : "Routine stopped feeling ordinary here; it started feeling more settled.";
  }

  if (chapter.dominant_emotion === "romantic") {
    return "A phase shaped by warmth, steadiness, and a strong sense of return.";
  }

  if (chapter.dominant_emotion === "supportive") {
    return "A phase where care showed up clearly and kept the archive feeling held together.";
  }

  return "A part of the story that quietly left its own shape behind.";
}

function personalizeMilestoneSummary(milestone: BookMilestone): string {
  const title = milestone.display_title.toLowerCase();

  if (title.includes("birthday")) {
    return "A birthday message that carried more than the date itself.";
  }

  if (title.includes("career")) {
    return "A day when the future felt a little more real for both of you.";
  }

  if (title.includes("repair") || title.includes("return")) {
    return "One of the moments where tenderness found its way back in.";
  }

  if (title.includes("support") || title.includes("sidelines")) {
    return "A clear reminder of how strongly support could show up here.";
  }

  if (title.includes("tense") || title.includes("conflict")) {
    return "A harder turn that still became part of what this archive carried through.";
  }

  return cleanDisplayText(buildExcerpt(milestone.short_summary, 90));
}

async function buildPayload(): Promise<BookPayload> {
  const [participants, signatureMetrics, emotionTimeline, messageFrequency, chapters, highlights, milestones, topicClusters, phraseMotifs] =
    await Promise.all([
      readPublicJson<Participant[]>("participants.json"),
      readPublicJson<SignatureMetrics>("signature_metrics.json"),
      readPublicJson<EmotionTimelinePoint[]>("emotion_timeline.json"),
      readPublicJson<MessageFrequency>("message_frequency.json"),
      readPublicJson<ChapterSegment[]>("chapter_segments.json"),
      readPublicJson<Highlight[]>("highlights.json"),
      readPublicJson<Milestone[]>("milestones.json"),
      readPublicJson<TopicCluster[]>("topic_clusters.json"),
      readPublicJson<PhraseMotif[]>("phrase_motifs.json"),
    ]);

  const [coverImage, chapterImage, lensImage, lenses] = await Promise.all([
    embedPreferredImage(["ebook-cover.png", "hero.png"]),
    embedPreferredImage(["ebook-chapter.png", "chapter-motif.png"]),
    embedPreferredImage(["ebook-closing.png", "lens-motif.png"]),
    computeLensCounts(),
  ]);

  const curatedHighlights = curateHighlights(highlights, {
    limit: 8,
    maxChars: 116,
    maxPerChapter: 2,
    maxPerSender: 3,
  });

  const curatedMilestones = curateMilestones(milestones, {
    limit: 6, // Reduced to 6 to fit A4 atlas page strictly
    maxPerChapter: 2,
    maxSameTitle: 2,
    allowCareerSignals: true,
  })
    .sort((left, right) => left.start_timestamp.localeCompare(right.start_timestamp))
    .map((milestone) => ({
      ...milestone,
      short_summary: personalizeMilestoneSummary(milestone),
    }));

  const curatedChapters = decorateChapters(chapters).map((chapter, index) => ({
    ...chapter,
    curated_summary: personalizeChapterSummary(chapter, index) || summarizeChapter(chapter),
    milestone:
      curatedMilestones.find((milestone) => milestone.chapter_id === chapter.chapter_id) ??
      (() => {
        const fallbackMilestone = curateMilestones(milestones.filter((milestone) => milestone.chapter_id === chapter.chapter_id), {
          limit: 1,
          maxPerChapter: 1,
          maxSameTitle: 1,
          allowCareerSignals: true,
        })[0];
        return fallbackMilestone
          ? {
              ...fallbackMilestone,
              short_summary: personalizeMilestoneSummary(fallbackMilestone),
            }
          : null;
      })() ??
      null,
    highlight:
      curateHighlights(highlights.filter((highlight) => highlight.chapter_id === chapter.chapter_id), {
        limit: 1,
        maxChars: 88,
        maxPerChapter: 1,
        maxPerSender: 1,
      })[0] ?? null,
  }));

  const monthlyVolume = getMonthlyVolume(messageFrequency).slice(-22);
  const { topics, motifs } = pickTopicMotifs(topicClusters, phraseMotifs);
  const profile = deriveProjectProfile(participants);
  const slug = slugify(profile.bookTitle);

  const headlineMetrics: BookMetric[] = [
    {
      label: "Messages shared",
      value: formatCompact(signatureMetrics.headline.total_messages),
      detail: `${messageFrequency.summary.active_days} active days`,
    },
    {
      label: "Longest streak",
      value: `${signatureMetrics.headline.longest_daily_streak} days`,
      detail: "days with messages in a row",
    },
    {
      label: "Most active month",
      value: signatureMetrics.headline.most_active_month.month_key,
      detail: `${formatCompact(signatureMetrics.headline.most_active_month.count)} messages`,
    },
    {
      label: "Late-night share",
      value: formatPercent(signatureMetrics.headline.late_night_percentage),
      detail: "nights that ran a little longer",
    },
  ];

  const replyGapMetrics = signatureMetrics.participant_reply_gaps.map((entry) => ({
    label: entry.label,
    value: `${entry.average_reply_gap_minutes.toFixed(1)} min avg reply gap`,
  }));

  const closingQuote =
    curateHighlights(
      highlights.filter(
        (highlight) =>
          highlight.emotion_label === "romantic" ||
          highlight.emotion_label === "supportive" ||
          highlight.archetype_tags.includes("repair_reconnection"),
      ),
      {
        limit: 1,
        maxChars: 120,
        maxPerChapter: 1,
        maxPerSender: 1,
      },
    )[0] ??
    curateHighlights(highlights, {
      limit: 1,
      maxChars: 120,
      maxPerChapter: 1,
      maxPerSender: 1,
    })[0] ??
    null;

  return {
    slug,
    presentation_mode: profile.presentationMode,
    title: profile.bookTitle,
    subtitle: profile.bookSubtitle,
    tagline: profile.bookTagline,
    participants: participants.map((participant) => participant.label),
    time_span: `${formatMonthYear(curatedChapters[0]?.start_timestamp ?? "")} - ${formatMonthYear(curatedChapters.at(-1)?.end_timestamp ?? "")}`,
    cover_image: coverImage,
    chapter_image: chapterImage,
    lens_image: lensImage,
    headline_metrics: headlineMetrics,
    reply_gap_metrics: replyGapMetrics,
    emotional_arc: emotionTimeline,
    monthly_volume: monthlyVolume,
    message_frequency: messageFrequency,
    chapters: curatedChapters,
    milestones: curatedMilestones,
    highlights: curatedHighlights,
    topics,
    motifs,
    lenses,
    signature_metrics: signatureMetrics,
    closing_quote: closingQuote,
    keepsake_line: profile.keepsakeLine,
  };
}

function renderHtml(payload: BookPayload): string {
  const heroMetrics = payload.headline_metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.detail)}</small>
        </article>
      `,
    )
    .join("");

  const replyGaps = payload.reply_gap_metrics
    .map(
      (entry) => `
        <article class="reply-card">
          <span>${escapeHtml(entry.label)}</span>
          <strong>${escapeHtml(entry.value)}</strong>
        </article>
      `,
    )
    .join("");

  const topicCards = payload.topics
    .map(
      (topic) => `
        <article class="topic-pill">
          <span>${escapeHtml(topic.label.replace(/_/gu, " "))}</span>
          <strong>${escapeHtml(formatCompact(topic.count))}</strong>
        </article>
      `,
    )
    .join("");

  const motifChips = payload.motifs
    .map(
      (motif) => `
        <span class="motif-chip">${escapeHtml(cleanDisplayText(motif.label))}<small>${escapeHtml(formatCompact(motif.count))}</small></span>
      `,
    )
    .join("");

  const milestoneAtlas = buildMilestoneAtlas(payload.milestones);
  const chapterCards = payload.chapters
    .map(
      (chapter) => `
        <article class="chapter-card">
          <span>${escapeHtml(chapter.phase_label)}</span>
          <h3>${escapeHtml(chapter.display_title)}</h3>
          <strong>${escapeHtml(formatCompact(chapter.message_count))} msgs</strong>
          <p>${escapeHtml(chapter.dominant_emotion)}</p>
        </article>
      `,
    )
    .join("");

  const memoryCloud = payload.motifs
    .slice(0, 8)
    .map(
      (motif) => `
        <span class="memory-cloud-chip">${escapeHtml(cleanDisplayText(motif.label))}</span>
      `,
    )
    .join("");

  const highlightRibbon = payload.highlights
    .slice(0, 3) // Hard limit to 3 to fit A4 height
    .map(
      (highlight) => `
        <article class="ribbon-card">
          <blockquote style="font-size: 11pt; line-height: 1.25;">&ldquo;${escapeHtml(highlight.excerpt)}&rdquo;</blockquote>
          <span style="font-size: 7.5pt; margin-top: 1mm; display: block;">${escapeHtml(highlight.sender_label ?? "Memory")} / ${escapeHtml(highlight.emotion_label)}</span>
        </article>
      `,
    )
    .join("");

  const chapterPages = buildChapterPages(payload.chapters, payload.chapter_image);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.title)} - ${escapeHtml(payload.subtitle)}</title>
    <style>
      @page { size: 210mm 297mm; margin: 0; }
      :root {
        --ink: #32262a;
        --muted: #80656e;
        --rose: #d88da5;
        --rose-deep: #b96b84;
        --ivory: #fffbf8;
        --paper: #fffdfc;
        --line: rgba(134, 105, 112, 0.12);
        --shadow: 0 12px 40px rgba(115, 92, 100, 0.08);
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        height: 297mm;
        font-family: "Palatino", "Georgia", serif;
        color: var(--ink);
        background: #fdfaf9;
        -webkit-font-smoothing: antialiased;
      }
      .book { width: 210mm; margin: 0 auto; }
      .page {
        position: relative;
        width: 210mm;
        height: 297mm;
        padding: 30mm 25mm;
        overflow: hidden;
        background: var(--paper);
        break-after: page;
        display: flex;
        flex-direction: column;
      }
      .page::after {
        content: "";
        position: absolute;
        inset: 0;
        background: url('https://www.transparenttextures.com/patterns/felt.png'); /* Subtle paper grain */
        opacity: 0.03;
        pointer-events: none;
      }
      .page-number {
        position: absolute;
        right: 20mm;
        bottom: 12mm;
        color: var(--rose-deep);
        font: 600 8pt "Montserrat", "Segoe UI", sans-serif;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        opacity: 0.6;
      }
      .page-art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.25;
        mix-blend-mode: multiply;
        transition: opacity 0.4s ease;
      }
      .page-art--cover { opacity: 0.4; }
      .page-art--chapter { opacity: 0.12; }
      
      .cover { display: flex; flex-direction: column; justify-content: space-between; padding: 30mm 20mm; }
      .cover-shell { position: relative; z-index: 10; display: grid; gap: 10mm; }
      .cover-kicker, .eyebrow {
        display: inline-block;
        color: var(--rose-deep);
        font: 700 8pt "Montserrat", "Segoe UI", sans-serif;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        margin-bottom: 4mm;
      }
      h1, h2, h3 { margin: 0; font-family: "Playfair Display", "Georgia", serif; font-weight: 400; line-height: 1.1; }
      h1 { font-size: 42pt; letter-spacing: -0.02em; }
      h2 { font-size: 28pt; letter-spacing: -0.01em; color: var(--ink); }
      h3 { font-size: 18pt; color: var(--muted); }
      p {
        margin: 0;
        color: var(--muted);
        font: 11pt/1.6 "Palatino", "Georgia", serif;
      }
      .cover-title { display: grid; gap: 4mm; max-width: 120mm; }
      .cover-title p { max-width: 90mm; font-size: 12pt; font-style: italic; }
      .cover-metrics {
        display: flex;
        gap: 8mm;
        margin-top: 5mm;
      }
      .metric-card, .chapter-card, .topic-pill, .atlas-card, .chapter-note, .chapter-quote-card {
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .metric-card { display: grid; gap: 2mm; }
      .metric-card span, .chapter-card span, .topic-pill span, .atlas-date {
        color: var(--rose-deep);
        font: 700 7pt "Montserrat", sans-serif;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      .metric-card strong { font-size: 22pt; font-family: "Playfair Display", serif; }
      .metric-card small { color: var(--muted); font-size: 9pt; }
      
      .cover-footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        position: relative;
        z-index: 10;
        border-top: 1px solid var(--line);
        padding-top: 8mm;
      }
      .participant-lockup strong { 
        display: block; 
        font-size: 16pt; 
        font-family: "Playfair Display", serif; 
        margin-bottom: 2mm; 
      }
      .overview-grid, .signals-grid, .chapter-map-grid, .themes-grid {
        position: relative;
        z-index: 10;
        display: grid;
        gap: 12mm;
        margin-top: 10mm;
      }
      .overview-grid { grid-template-columns: 1fr 1fr; align-items: stretch; }
      .hero-stat-box {
        display: grid;
        gap: 6mm;
        grid-column: span 2;
        margin-bottom: 8mm;
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 6mm;
      }
      .panel-kicker span {
        color: var(--rose-deep);
        font: 700 7pt "Montserrat", sans-serif;
        letter-spacing: 0.25em;
        text-transform: uppercase;
      }
      .stat-stack { display: grid; gap: 3mm; }
      .stat-row {
        display: flex;
        justify-content: space-between;
        gap: 3mm;
        padding-bottom: 2.5mm;
        border-bottom: 1px solid var(--line);
      }
      .stat-row:last-child { border-bottom: 0; padding-bottom: 0; }
      .stat-row span { color: var(--muted); font: 9pt "Segoe UI", sans-serif; }
      .stat-row strong { font-size: 14pt; font-family: "Playfair Display", serif; }
      .chart-svg text, .heatmap-axis, .timeline-name, .timeline-detail, .timeline-caption, .lens-name, .lens-value, .gauge-value, .gauge-label {
        fill: #47383e;
        font-family: "Montserrat", sans-serif;
        font-weight: 500;
      }
      .lens-value { font-size: 11pt; font-weight: 700; }
      .lens-name { font-size: 8pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
      .gauge-value { font-size: 24pt; font-weight: 400; font-family: "Playfair Display", serif; }
      .gauge-label { font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: var(--rose-deep); }
      .reply-grid { display: grid; gap: 3mm; }
      .reply-card { padding: 4mm; }
      .reply-card strong { font-size: 12.5pt; }
      .chapter-card-grid, .topic-grid, .atlas-grid, .ribbon-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4mm;
      }
      .chapter-card, .topic-pill, .ribbon-card, .atlas-card { display: grid; gap: 2mm; padding: 4mm; }
      .chapter-card p, .atlas-card p { font-size: 9pt; }
      .ribbon-card { border-left: 2px solid var(--rose); padding-left: 5mm; margin-bottom: 2mm; }
      .motif-cloud { display: flex; flex-wrap: wrap; gap: 2.5mm; }
      .motif-chip {
        display: inline-flex;
        align-items: center;
        gap: 2mm;
        padding: 2mm 3.5mm;
        border-radius: 999px;
        border: 1px solid rgba(216, 141, 165, 0.2);
        background: rgba(255, 248, 249, 0.94);
        color: var(--rose-deep);
        font: 700 7.75pt "Segoe UI", sans-serif;
      }
      .motif-chip small { color: var(--muted); font-size: 7.5pt; font-weight: 600; }
      .memory-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 3mm;
        margin-top: 6mm;
      }
      .memory-cloud-chip {
        display: inline-flex;
        align-items: center;
        padding: 2mm 5mm;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: transparent;
        color: var(--ink);
        font: 600 8.5pt "Montserrat", sans-serif;
        letter-spacing: 0.04em;
      }
      .topic-pill strong { font-size: 14pt; }
      .page--chapter {
        background:
          radial-gradient(circle at top left, rgba(246, 205, 221, 0.42), transparent 28%),
          linear-gradient(180deg, #fffdfa 0%, #fff5f4 100%);
      }
      .page-chapter-grid {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 7mm;
        align-items: stretch;
        margin-top: 14mm;
      }
      .chapter-copy { display: grid; gap: 4.5mm; align-content: start; }
      .chapter-summary { max-width: 78mm; font-size: 9.8pt; }
      .chapter-stats { display: grid; gap: 3mm; }
      .chapter-stats div { display: grid; gap: 0.8mm; padding-bottom: 2.5mm; border-bottom: 1px solid var(--line); }
      .chapter-stats div:last-child { border-bottom: 0; }
      .chapter-stats span {
        color: var(--muted);
        font: 7.75pt "Segoe UI", sans-serif;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .chapter-stats strong { font-size: 12.5pt; }
      .chapter-side { display: grid; gap: 4mm; align-content: end; }
      .chapter-note, .chapter-quote-card { display: grid; gap: 2.5mm; padding: 5mm; }
      .eyebrow--soft { opacity: 0.86; }
      .chapter-quote-card blockquote { font-size: 14pt; }
      .atlas-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 6mm; }
      .atlas-card--accent { background: rgba(255, 247, 248, 0.94); }
      .closing { display: grid; align-content: space-between; }
      .closing-shell {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 8mm;
        max-width: 102mm;
      }
      .closing blockquote { font-size: 20pt; line-height: 1.24; }
      .closing p { font-size: 10.5pt; }
    </style>
  </head>
  <body>
    <main class="book">
      <section class="page cover">
        <img class="page-art page-art--cover" src="${payload.cover_image}" alt="" />
        <div class="cover-shell">
          <div class="cover-title">
            <span class="cover-kicker">${escapeHtml(payload.presentation_mode === "gift" ? "For you" : "Conversation Archive")}</span>
            
            <h1>${escapeHtml(payload.title)}<br/>${escapeHtml(payload.subtitle)}</h1>
            <p>${escapeHtml(payload.tagline)}</p>
          </div>
          <div class="cover-metrics">${heroMetrics}</div>
        </div>
        <div class="cover-footer">
          <p>${escapeHtml(payload.time_span)}</p>
          <div class="participant-lockup">
            <strong>${escapeHtml(payload.participants.join(" + "))}</strong>
            <p>made from the way we kept talking, waiting, and returning</p>
          </div>
        </div>
      </section>

      <section class="page">
        <div class="page-number">2</div>
        <div class="hero-stat-box">
          <span class="eyebrow">What We Built</span>
          <h2>Our rhythm, at a glance</h2>
          <p>
            A few of the patterns that shaped this archive.
          </p>
        </div>
        <div class="overview-grid">
          <div class="panel">
            <div class="stat-stack">
              <div class="stat-row"><span>Most active day</span><strong>${escapeHtml(formatIsoDate(payload.signature_metrics.headline.most_active_day.day_key))}</strong></div>
              <div class="stat-row"><span>Most active month</span><strong>${escapeHtml(payload.signature_metrics.headline.most_active_month.month_key)}</strong></div>
              <div class="stat-row"><span>Support moments</span><strong>${escapeHtml(formatCompact(payload.signature_metrics.headline.support_moments_count))}</strong></div>
              <div class="stat-row"><span>Conflict-repair cycles</span><strong>${escapeHtml(String(payload.signature_metrics.headline.conflict_repair_cycles))}</strong></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-kicker"><span>Response Gap</span></div>
            <div class="reply-grid">${replyGaps}</div>
          </div>
        </div>
      </section>

      <section class="page">
        <div class="page-number">3</div>
        <div class="hero-stat-box" style="margin-bottom: 12mm;">
          <span class="eyebrow">The Feeling</span>
          <h2>How our energy moved</h2>
          <p>
            The softer rises, the heavier weeks, and the calmer stretches that kept returning.
          </p>
        </div>
        <div style="flex-grow: 1; margin: 0 -25mm; position: relative;">
          ${createAreaChart(payload.emotional_arc, 720, 400)}
        </div>
      </section>

      <section class="page">
        <div class="page-number">4</div>
        <div class="signals-grid" style="grid-template-columns: 1fr; gap: 20mm;">
          <article class="panel">
            <div class="panel-kicker"><span>Time</span></div>
            <h3 style="margin-top: 4mm;">How the months filled up</h3>
            <div style="margin-top: 8mm;">${createMonthlyBarChart(payload.monthly_volume, 620, 240)}</div>
          </article>
          <article class="panel">
            <div class="panel-kicker"><span>Hours</span></div>
            <h3 style="margin-top: 4mm;">When activity clustered most</h3>
            <div style="margin-top: 8mm;">${createHeatmapSvg(payload.message_frequency, 620)}</div>
          </article>
        </div>
      </section>

      <section class="page">
        <div class="page-number">5</div>
        <div class="chapter-map-grid" style="grid-template-columns: 1fr; gap: 15mm;">
          <article class="panel">
            <div class="panel-kicker"><span>Phases</span></div>
            <h2>The way our story unfolded</h2>
            <div style="margin-top: 10mm;">${createChapterTimeline(payload.chapters, 680, 400)}</div>
          </article>
        </div>
      </section>

      <section class="page">
        <div class="page-number">6</div>
        <div class="overview-grid" style="grid-template-columns: 1.1fr 0.9fr;">
          <article class="panel">
            <div class="panel-kicker"><span>What Stayed</span></div>
            <h2>The moments that held their shape</h2>
            <p style="margin-top: 4mm;">
              Support, repair, and the little returns that mattered.
            </p>
            <div class="ribbon-grid" style="margin-top: 10mm; display: grid; gap: 8mm;">${highlightRibbon}</div>
          </article>
          <article class="panel" style="justify-content: center; align-items: center;">
            <div style="text-align: center;">
              <div class="panel-kicker"><span>After Midnight</span></div>
              <div style="margin-top: 8mm;">${createLateNightGauge(payload.signature_metrics.headline.late_night_percentage)}</div>
            </div>
          </article>
        </div>
      </section>

      ${chapterPages}

      <section class="page">
        <img class="page-art" src="${payload.lens_image}" alt="" />
        <div class="page-number">13</div>
        <div class="themes-grid" style="grid-template-columns: 1fr; gap: 15mm; flex-grow: 1;">
          <article class="panel">
            <div class="panel-kicker"><span>Us, In Pieces</span></div>
            <h2>The shapes our conversations took</h2>
            <div style="margin-top: 8mm;">${createLensGarden(payload.lenses, 640, 360)}</div>
          </article>
          <article class="panel">
            <div class="panel-kicker"><span>Echoes</span></div>
            <h3 style="margin-top: 2mm;">Small phrases that stayed in the archive</h3>
            <div class="memory-cloud" style="margin-top: 6mm;">${memoryCloud}</div>
          </article>
        </div>
      </section>

      <section class="page">
        <div class="page-number">14</div>
        <div class="hero-stat-box" style="margin-bottom: 12mm;">
          <span class="eyebrow">The Turns</span>
          <h2>What changed the story</h2>
          <p>
            The dates that quietly shifted everything.
          </p>
        </div>
        <div class="atlas-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12mm;">${milestoneAtlas}</div>
      </section>

      <section class="page closing" style="justify-content: center; align-items: center; text-align: center;">
        <img class="page-art" src="${payload.cover_image}" alt="" style="opacity: 0.1;" />
        <div class="closing-shell">
          <span class="eyebrow">Still Ours</span>
          ${
            payload.closing_quote
              ? `<blockquote style="font-family: 'Playfair Display', serif; font-size: 28pt; font-style: italic; line-height: 1.2; margin-bottom: 12mm;">&ldquo;${escapeHtml(payload.closing_quote.excerpt)}&rdquo;</blockquote>`
              : `<blockquote style="font-family: 'Playfair Display', serif; font-size: 28pt; font-style: italic; line-height: 1.2; margin-bottom: 12mm;">Even when the days blur together, the archive still leaves a shape behind.</blockquote>`
          }
          <p style="font-style: italic; opacity: 0.6;">${escapeHtml(payload.keepsake_line)}</p>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const payload = await buildPayload();
  const html = renderHtml(payload);
  const htmlPath = path.join(OUTPUT_DIR, `${payload.slug}.html`);
  const jsonPath = path.join(OUTPUT_DIR, `${payload.slug}.json`);
  const pdfPath = path.join(OUTPUT_DIR, `${payload.slug}.pdf`);
  const latestHtmlPath = path.join(OUTPUT_DIR, "latest-ebook.html");
  const latestJsonPath = path.join(OUTPUT_DIR, "latest-ebook.json");
  const manifest: EbookManifest = {
    slug: payload.slug,
    title: payload.title,
    html_path: htmlPath,
    json_path: jsonPath,
    pdf_path: pdfPath,
    generated_at: new Date().toISOString(),
  };

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(htmlPath, html, "utf8");
  await fs.writeFile(latestJsonPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.writeFile(latestHtmlPath, html, "utf8");
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`Wrote ${path.relative(ROOT_DIR, jsonPath)}`);
  console.log(`Wrote ${path.relative(ROOT_DIR, htmlPath)}`);
  console.log(`Wrote ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
