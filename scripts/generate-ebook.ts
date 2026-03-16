import { promises as fs } from "node:fs";
import path from "node:path";

import type { ArchetypeLabel } from "../pipeline/config.js";
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

type DashboardParticipantOverview = {
  participant_id: string;
  label: string;
  total_messages: number;
  message_share: number;
  average_words_per_message: number;
  average_chars_per_message: number;
  emoji_count: number;
  emoji_share: number;
  emoji_per_message: number;
  link_count: number;
  multiline_count: number;
  multiline_share: number;
  weekend_percentage: number;
  late_night_percentage: number;
  session_opener_count: number;
  session_opener_share: number;
  longest_message_length: number;
  average_reply_gap_minutes: number;
};

type DashboardInsights = {
  participants: DashboardParticipantOverview[];
  time_patterns: {
    monthly_split: Array<{
      month_key: string;
      total_messages: number;
      participant_counts: Record<string, number>;
      late_night_count: number;
    }>;
    weekday_distribution: Array<{
      label: string;
      total_messages: number;
      participant_counts: Record<string, number>;
      weekday: number;
    }>;
    hour_distribution: Array<{
      label: string;
      total_messages: number;
      participant_counts: Record<string, number>;
      hour_of_day: number;
    }>;
  };
  session_patterns: {
    longest_sessions: Array<{
      technical_session_id: string;
      start_timestamp: string;
      end_timestamp: string;
      message_count: number;
      density_score: number;
      dominant_emotion: string;
      participant_counts: Record<string, number>;
    }>;
    fastest_exchange_windows: Array<{
      technical_session_id: string;
      start_timestamp: string;
      end_timestamp: string;
      average_reply_gap_minutes: number;
      message_count: number;
    }>;
    highest_volume_days: Array<{
      day_key: string;
      count: number;
    }>;
  };
  emotion_patterns: {
    overall_emotion_mix: Array<{ label: string; count: number }>;
    overall_archetype_mix: Array<{ label: string; count: number }>;
    participant_signal_totals: Array<{
      participant_id: string;
      label: string;
      support_count: number;
      conflict_count: number;
      repair_count: number;
    }>;
    signal_trend: Array<{
      month_key: string;
      support_count: number;
      conflict_count: number;
      repair_count: number;
    }>;
  };
  detective_records: Array<{
    record_id: string;
    label: string;
    value: string;
    detail: string;
    winner_participant_id: string | null;
    winner_label: string | null;
    route: string;
  }>;
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
  dashboard: DashboardInsights;
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

function createSplitMonthlyChart(
  points: Array<{
    month_key: string;
    total_messages: number;
    participant_counts: Record<string, number>;
  }>,
  participantIds: string[],
  width: number,
  height: number,
): string {
  const margin = { top: 18, right: 0, bottom: 32, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(...points.map((point) => point.total_messages), 1);
  const barWidth = innerWidth / Math.max(points.length, 1);
  const [firstParticipantId, secondParticipantId] = participantIds;

  const bars = points
    .map((point, index) => {
      const firstCount = point.participant_counts[firstParticipantId] ?? 0;
      const secondCount = point.participant_counts[secondParticipantId] ?? 0;
      const firstHeight = (firstCount / maxCount) * innerHeight;
      const secondHeight = (secondCount / maxCount) * innerHeight;
      const x = margin.left + index * barWidth + barWidth * 0.16;
      const ySecond = margin.top + innerHeight - secondHeight;
      const yFirst = ySecond - firstHeight;
      const showLabel = index % Math.max(1, Math.floor(points.length / 6)) === 0 || index === points.length - 1;
      const labelX = x + (barWidth * 0.68) / 2;
      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${ySecond.toFixed(1)}" width="${(barWidth * 0.68).toFixed(1)}" height="${secondHeight.toFixed(1)}" rx="4" fill="#efb7c6" opacity="0.92" />
          <rect x="${x.toFixed(1)}" y="${yFirst.toFixed(1)}" width="${(barWidth * 0.68).toFixed(1)}" height="${firstHeight.toFixed(1)}" rx="4" fill="#c97d96" opacity="0.9" />
          ${showLabel ? `<text x="${labelX.toFixed(1)}" y="${height - 2}" text-anchor="middle" font-size="6.7pt" style="text-transform:uppercase;opacity:0.55;letter-spacing:0.05em;">${escapeHtml(point.month_key.slice(2))}</text>` : ""}
        </g>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Monthly split chart">
      <line x1="0" y1="${margin.top + innerHeight}" x2="${width}" y2="${margin.top + innerHeight}" stroke="var(--line-strong)" />
      ${bars}
    </svg>
  `;
}

function createDonutSplitChart(participants: DashboardParticipantOverview[], size = 250): string {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const totalMessages = participants.reduce((sum, participant) => sum + participant.total_messages, 0);
  let offset = 0;
  const colors = ["#c97d96", "#efb7c6"];

  const arcs = participants
    .map((participant, index) => {
      const fraction = totalMessages === 0 ? 0 : participant.total_messages / totalMessages;
      const arcLength = fraction * circumference;
      const circle = `
        <circle
          cx="${center}"
          cy="${center}"
          r="${radius}"
          fill="none"
          stroke="${colors[index % colors.length]}"
          stroke-width="24"
          stroke-linecap="butt"
          stroke-dasharray="${arcLength.toFixed(2)} ${(circumference - arcLength).toFixed(2)}"
          stroke-dashoffset="${(-offset).toFixed(2)}"
          transform="rotate(-90 ${center} ${center})"
        />
      `;
      offset += arcLength;
      return circle;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" class="chart-svg" aria-label="Message share split">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#f6e4e9" stroke-width="24" />
      ${arcs}
      <text x="${center}" y="${center - 8}" text-anchor="middle" class="donut-overline">together</text>
      <text x="${center}" y="${center + 18}" text-anchor="middle" class="donut-value">${escapeHtml(formatCompact(totalMessages))}</text>
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
  const rowHeight = Math.max(24, Math.floor((height - margin.top - margin.bottom) / Math.max(chapters.length, 1)));
  const trackHeight = 8;
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

function createSignalTrendChart(
  points: Array<{ month_key: string; support_count: number; conflict_count: number; repair_count: number }>,
  width: number,
  height: number,
): string {
  const margin = { top: 18, right: 8, bottom: 28, left: 0 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(
    ...points.flatMap((point) => [point.support_count, point.conflict_count, point.repair_count]),
    1,
  );

  const buildPath = (key: "support_count" | "conflict_count" | "repair_count") =>
    points
      .map((point, index) => {
        const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
        const y = margin.top + innerHeight - (point[key] / maxValue) * innerHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const labels = points
    .filter((_, index) => index % Math.max(1, Math.floor(points.length / 5)) === 0 || index === points.length - 1)
    .map((point, index, array) => {
      const x = margin.left + (points.indexOf(point) / Math.max(points.length - 1, 1)) * innerWidth;
      const anchor = index === array.length - 1 ? "end" : "middle";
      return `<text x="${x.toFixed(1)}" y="${height - 2}" text-anchor="${anchor}" font-size="6.5pt" style="text-transform:uppercase;opacity:0.55;letter-spacing:0.05em;">${escapeHtml(point.month_key.slice(2))}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Support conflict repair trend">
      <path d="${buildPath("support_count")}" fill="none" stroke="#b96b84" stroke-width="2.2" stroke-linecap="round" />
      <path d="${buildPath("repair_count")}" fill="none" stroke="#d99aac" stroke-width="2" stroke-linecap="round" />
      <path d="${buildPath("conflict_count")}" fill="none" stroke="#7e5f68" stroke-width="1.6" stroke-linecap="round" opacity="0.7" />
      ${labels}
    </svg>
  `;
}

function createLensGarden(lenses: BookLens[], width: number, height: number): string {
  const maxCount = Math.max(...lenses.map((lens) => lens.count), 1);
  const positions = [
    { x: width * 0.16, y: height * 0.44 },
    { x: width * 0.42, y: height * 0.24 },
    { x: width * 0.76, y: height * 0.4 },
    { x: width * 0.28, y: height * 0.78 },
    { x: width * 0.56, y: height * 0.8 },
    { x: width * 0.86, y: height * 0.68 },
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

function deriveLensesFromDashboard(dashboard: DashboardInsights): BookLens[] {
  const total = dashboard.emotion_patterns.overall_archetype_mix.reduce((sum, entry) => sum + entry.count, 0);

  return dashboard.emotion_patterns.overall_archetype_mix
    .filter((entry): entry is { label: ArchetypeLabel; count: number } => entry.label in ARCHETYPE_META)
    .map((entry) => ({
      archetype: entry.label,
      title: ARCHETYPE_META[entry.label]?.title ?? humanizeArchetypeLabel(entry.label),
      mood: ARCHETYPE_META[entry.label]?.mood ?? "story signal",
      count: entry.count,
      share: total === 0 ? 0 : entry.count / total,
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
  const [participants, signatureMetrics, emotionTimeline, messageFrequency, chapters, highlights, milestones, topicClusters, phraseMotifs, dashboard] =
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
      readPublicJson<DashboardInsights>("dashboard_insights.json"),
    ]);

  const [coverImage, chapterImage, lensImage] = await Promise.all([
    embedPreferredImage(["ebook-cover.png", "hero.png"]),
    embedPreferredImage(["ebook-chapter.png", "chapter-motif.png"]),
    embedPreferredImage(["ebook-closing.png", "lens-motif.png"]),
  ]);
  const lenses = deriveLensesFromDashboard(dashboard);

  const curatedHighlights = curateHighlights(highlights, {
    limit: 4,
    maxChars: 88,
    maxPerChapter: 2,
    maxPerSender: 2,
  });

  const curatedMilestones = curateMilestones(milestones, {
    limit: 5,
    maxPerChapter: 2,
    maxSameTitle: 1,
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
    dashboard,
    closing_quote: closingQuote,
    keepsake_line: profile.keepsakeLine,
  };
}

function renderHtml(payload: BookPayload): string {
  const dashboardParticipants = payload.dashboard.participants.slice(0, 2);
  const participantIds = dashboardParticipants.map((participant) => participant.participant_id);
  const heroMetrics = payload.headline_metrics
    .map(
      (metric) => `
        <article class="hero-metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <small>${escapeHtml(metric.detail)}</small>
        </article>
      `,
    )
    .join("");

  const participantLegends = dashboardParticipants
    .map(
      (participant, index) => `
        <span class="legend-pill">
          <i class="legend-dot legend-dot--${index + 1}"></i>
          ${escapeHtml(participant.label)}
        </span>
      `,
    )
    .join("");

  const participantSignatureCards = dashboardParticipants
    .map(
      (participant) => `
        <article class="signature-card">
          <div class="signature-head">
            <div>
              <span class="section-kicker section-kicker--tiny">${escapeHtml(participant.label)}</span>
              <h3>${escapeHtml(formatPercent(participant.message_share))} share</h3>
            </div>
            <strong>${escapeHtml(formatCompact(participant.total_messages))}</strong>
          </div>
          <div class="signature-grid">
            <div><span>words / msg</span><strong>${escapeHtml(participant.average_words_per_message.toFixed(1))}</strong></div>
            <div><span>emoji / msg</span><strong>${escapeHtml(participant.emoji_per_message.toFixed(2))}</strong></div>
            <div><span>late night</span><strong>${escapeHtml(formatPercent(participant.late_night_percentage))}</strong></div>
            <div><span>openers</span><strong>${escapeHtml(String(participant.session_opener_count))}</strong></div>
            <div><span>reply gap</span><strong>${escapeHtml(`${participant.average_reply_gap_minutes.toFixed(1)}m`)}</strong></div>
            <div><span>longest note</span><strong>${escapeHtml(formatCompact(participant.longest_message_length))}</strong></div>
          </div>
        </article>
      `,
    )
    .join("");

  const detectiveCards = payload.dashboard.detective_records
    .slice(0, 4)
    .map(
      (record) => `
        <article class="mini-card mini-card--stat">
          <span>${escapeHtml(record.label)}</span>
          <strong>${escapeHtml(record.value)}</strong>
          <small>${escapeHtml(record.detail)}</small>
        </article>
      `,
    )
    .join("");

  const maxEmotion = Math.max(...payload.dashboard.emotion_patterns.overall_emotion_mix.map((entry) => entry.count), 1);
  const emotionRows = payload.dashboard.emotion_patterns.overall_emotion_mix
    .slice(0, 5)
    .map(
      (emotion) => `
        <div class="bar-row">
          <div class="bar-copy"><span>${escapeHtml(emotion.label)}</span><strong>${escapeHtml(formatCompact(emotion.count))}</strong></div>
          <div class="bar-track"><i class="bar-fill" style="width:${((emotion.count / maxEmotion) * 100).toFixed(1)}%"></i></div>
        </div>
      `,
    )
    .join("");

  const archetypeRows = payload.lenses
    .slice(0, 5)
    .map(
      (lens) => `
        <div class="bar-row">
          <div class="bar-copy"><span>${escapeHtml(lens.title)}</span><strong>${escapeHtml(formatCompact(lens.count))}</strong></div>
          <div class="bar-track"><i class="bar-fill bar-fill--soft" style="width:${(lens.share * 100).toFixed(1)}%"></i></div>
        </div>
      `,
    )
    .join("");

  const signalCards = payload.dashboard.emotion_patterns.participant_signal_totals
    .map(
      (entry) => `
        <article class="mini-card">
          <span>${escapeHtml(entry.label)}</span>
          <strong>${escapeHtml(formatCompact(entry.support_count))} support</strong>
          <small>${escapeHtml(formatCompact(entry.repair_count))} repair / ${escapeHtml(formatCompact(entry.conflict_count))} conflict</small>
        </article>
      `,
    )
    .join("");

  const milestoneCards = payload.milestones
    .slice(0, 4)
    .map(
      (milestone) => `
        <article class="timeline-note">
          <span>${escapeHtml(formatMonthYear(milestone.start_timestamp))}</span>
          <h3>${escapeHtml(milestone.display_title)}</h3>
          <p>${escapeHtml(buildExcerpt(milestone.short_summary, 68))}</p>
        </article>
      `,
    )
    .join("");

  const sessionCards = [
    payload.dashboard.session_patterns.longest_sessions[0]
      ? `
          <article class="mini-card mini-card--stat">
            <span>longest stretch</span>
            <strong>${escapeHtml(formatCompact(payload.dashboard.session_patterns.longest_sessions[0].message_count))}</strong>
            <small>${escapeHtml(formatMonthYear(payload.dashboard.session_patterns.longest_sessions[0].start_timestamp))}</small>
          </article>
        `
      : "",
    payload.dashboard.session_patterns.fastest_exchange_windows[0]
      ? `
          <article class="mini-card mini-card--stat">
            <span>fastest exchange</span>
            <strong>${escapeHtml(`${payload.dashboard.session_patterns.fastest_exchange_windows[0].average_reply_gap_minutes.toFixed(1)} min`)}</strong>
            <small>${escapeHtml(formatCompact(payload.dashboard.session_patterns.fastest_exchange_windows[0].message_count))} messages in one window</small>
          </article>
        `
      : "",
    payload.dashboard.session_patterns.highest_volume_days[0]
      ? `
          <article class="mini-card mini-card--stat">
            <span>loudest day</span>
            <strong>${escapeHtml(formatIsoDate(payload.dashboard.session_patterns.highest_volume_days[0].day_key))}</strong>
            <small>${escapeHtml(formatCompact(payload.dashboard.session_patterns.highest_volume_days[0].count))} messages</small>
          </article>
        `
      : "",
  ].join("");

  const motifCloud = payload.motifs
    .slice(0, 10)
    .map(
      (motif) => `
        <span class="motif-chip">${escapeHtml(cleanDisplayText(motif.label))}</span>
      `,
    )
    .join("");

  const topicPills = payload.topics
    .slice(0, 4)
    .map(
      (topic) => `
        <span class="legend-pill">${escapeHtml(topic.label.replace(/_/gu, " "))}</span>
      `,
    )
    .join("");

  const memorySnippets = payload.highlights
    .slice(0, 2)
    .map(
      (highlight) => `
        <article class="quote-slice">
          <blockquote>&ldquo;${escapeHtml(cleanDisplayText(highlight.excerpt))}&rdquo;</blockquote>
          <small>${escapeHtml(highlight.sender_label ?? "Memory")} / ${escapeHtml(highlight.emotion_label)}</small>
        </article>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(payload.title)} - ${escapeHtml(payload.subtitle)}</title>
    <style>
      @page { size: 192mm 240mm; margin: 0; }
      :root {
        --page-w: 192mm;
        --page-h: 240mm;
        --ink: #392b31;
        --ink-soft: #6d5961;
        --rose: #e2a6b7;
        --rose-deep: #c97d96;
        --rose-soft: #f4dbe3;
        --paper: #fffaf8;
        --paper-warm: #fff4ef;
        --card: rgba(255, 255, 255, 0.72);
        --line: rgba(159, 119, 131, 0.16);
        --line-strong: rgba(159, 119, 131, 0.26);
        --shadow: 0 18px 44px rgba(145, 105, 118, 0.10);
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: var(--page-w);
        min-height: var(--page-h);
        background: #f9f3f1;
        color: var(--ink);
        font-family: "Georgia", "Times New Roman", serif;
        -webkit-font-smoothing: antialiased;
      }
      .book { width: var(--page-w); margin: 0 auto; }
      .page {
        position: relative;
        width: var(--page-w);
        height: var(--page-h);
        padding: 16mm 15mm 14mm;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
        background:
          radial-gradient(circle at top left, rgba(244, 216, 225, 0.52), transparent 30%),
          radial-gradient(circle at top right, rgba(255, 237, 226, 0.75), transparent 28%),
          linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
      }
      .page::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.56), transparent 20%),
          radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.44), transparent 16%),
          radial-gradient(circle at 50% 100%, rgba(248, 219, 228, 0.36), transparent 28%);
        pointer-events: none;
      }
      .page-number {
        position: absolute;
        right: 12mm;
        bottom: 8mm;
        color: var(--rose-deep);
        font: 700 6.8pt "Segoe UI", sans-serif;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        opacity: 0.58;
      }
      .page-art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.20;
      }
      .page-art--cover { opacity: 0.75; }
      .page-art--ambient { opacity: 0.18; }
      .page-art--closing { opacity: 0.5; }
      .cover-overlay {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(135deg, rgba(255, 251, 248, 0.78) 10%, rgba(255, 244, 239, 0.46) 46%, rgba(255, 244, 239, 0.70) 100%);
      }
      .shell { position: relative; z-index: 2; }
      h1, h2, h3, h4, p, blockquote { margin: 0; }
      h1, h2, h3, h4 {
        font-family: "Georgia", "Times New Roman", serif;
        font-weight: 400;
        letter-spacing: -0.03em;
      }
      h1 { font-size: 35pt; line-height: 0.98; }
      h2 { font-size: 24pt; line-height: 1.02; }
      h3 { font-size: 15pt; line-height: 1.08; }
      h4 { font-size: 12pt; line-height: 1.12; }
      p {
        color: var(--ink-soft);
        font: 9.4pt/1.46 "Segoe UI", sans-serif;
      }
      .section-kicker {
        display: inline-flex;
        color: var(--rose-deep);
        font: 700 7pt "Segoe UI", sans-serif;
        letter-spacing: 0.28em;
        text-transform: uppercase;
      }
      .section-kicker--tiny { font-size: 6.2pt; letter-spacing: 0.22em; }
      .glass-card, .mini-card, .timeline-note, .signature-card, .hero-metric, .quote-slice {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 8mm;
        box-shadow: var(--shadow);
      }
      .hero-metric {
        padding: 5mm 4.5mm;
        display: grid;
        gap: 1.5mm;
        min-height: 31mm;
      }
      .hero-metric span, .mini-card span, .timeline-note span {
        color: var(--rose-deep);
        font: 700 6.6pt "Segoe UI", sans-serif;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .hero-metric strong { font-size: 18pt; }
      .hero-metric small, .mini-card small, .quote-slice small {
        color: var(--ink-soft);
        font: 7.8pt/1.35 "Segoe UI", sans-serif;
      }
      .cover {
        display: grid;
        grid-template-rows: auto 1fr auto;
      }
      .cover-title {
        display: grid;
        gap: 5mm;
        max-width: 96mm;
      }
      .cover-title p {
        max-width: 84mm;
        font-size: 10.2pt;
      }
      .cover-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4mm;
        align-self: start;
        width: 64mm;
        justify-self: end;
      }
      .cover-grid {
        display: grid;
        grid-template-columns: 1.12fr 0.88fr;
        gap: 8mm;
        align-items: end;
        margin-top: 10mm;
      }
      .cover-footer {
        display: flex;
        justify-content: space-between;
        align-items: end;
        padding-top: 8mm;
        border-top: 1px solid rgba(255,255,255,0.45);
      }
      .cover-footer strong { display: block; font-size: 13pt; }
      .page-grid {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 6mm;
        height: 100%;
      }
      .overview-top {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 6mm;
      }
      .overview-hero {
        display: grid;
        gap: 4mm;
        align-content: start;
      }
      .overview-panels { display: grid; gap: 6mm; }
      .panel {
        padding: 5.5mm;
        display: grid;
        gap: 4mm;
      }
      .duo-grid {
        display: grid;
        grid-template-columns: 1.08fr 0.92fr;
        gap: 6mm;
      }
      .stack { display: grid; gap: 5mm; }
      .dense-stack { display: grid; gap: 3.2mm; }
      .legend-row, .topic-row {
        display: flex;
        flex-wrap: wrap;
        gap: 2.5mm;
      }
      .legend-pill, .motif-chip {
        display: inline-flex;
        align-items: center;
        gap: 2mm;
        padding: 2.2mm 3.4mm;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.55);
        color: var(--ink);
        font: 600 7.2pt "Segoe UI", sans-serif;
      }
      .legend-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        display: inline-block;
      }
      .legend-dot--1 { background: #c97d96; }
      .legend-dot--2 { background: #efb7c6; }
      .donut-overline, .donut-value, .gauge-value, .gauge-label, .lens-name, .lens-value, .chart-svg text, .heatmap-axis {
        fill: var(--ink);
        font-family: "Segoe UI", sans-serif;
      }
      .donut-overline {
        font-size: 6.8pt;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        fill: var(--rose-deep);
      }
      .donut-value {
        font-size: 19pt;
        font-family: "Georgia", serif;
      }
      .chart-box {
        padding: 5.5mm;
        display: grid;
        gap: 3mm;
      }
      .chart-box svg { width: 100%; height: auto; display: block; }
      .chart-title { display: grid; gap: 2mm; }
      .chart-title h3 { font-size: 17pt; }
      .comparison-strip { display: grid; gap: 3mm; }
      .comparison-row { display: grid; gap: 1.5mm; }
      .comparison-copy {
        display: flex;
        justify-content: space-between;
        gap: 3mm;
        font: 7.8pt "Segoe UI", sans-serif;
        color: var(--ink-soft);
      }
      .comparison-track, .bar-track {
        height: 6px;
        border-radius: 999px;
        background: rgba(231, 203, 212, 0.72);
        overflow: hidden;
      }
      .comparison-fill, .bar-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #c97d96 0%, #e4a2b5 100%);
      }
      .comparison-fill--soft, .bar-fill--soft {
        background: linear-gradient(90deg, #d49fb0 0%, #f0c5d0 100%);
      }
      .signature-card {
        padding: 5mm;
        display: grid;
        gap: 4mm;
      }
      .signature-head {
        display: flex;
        justify-content: space-between;
        gap: 4mm;
        align-items: end;
      }
      .signature-head strong { font-size: 15pt; }
      .signature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 3mm;
      }
      .signature-grid div {
        padding: 3.3mm;
        border-radius: 5mm;
        background: rgba(255,255,255,0.46);
        border: 1px solid rgba(201, 125, 150, 0.12);
        display: grid;
        gap: 1mm;
      }
      .signature-grid span {
        color: var(--ink-soft);
        font: 600 6.3pt "Segoe UI", sans-serif;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .signature-grid strong { font-size: 11pt; }
      .mini-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4mm;
      }
      .mini-card {
        padding: 4.3mm;
        display: grid;
        gap: 1.5mm;
      }
      .mini-card strong { font-size: 13pt; }
      .mini-card--stat strong { font-size: 15pt; }
      .bar-row { display: grid; gap: 1.5mm; }
      .bar-copy {
        display: flex;
        justify-content: space-between;
        gap: 4mm;
        font: 7.6pt "Segoe UI", sans-serif;
        color: var(--ink-soft);
      }
      .bar-copy strong {
        font-size: 8pt;
        color: var(--ink);
      }
      .timeline-layout {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 6mm;
      }
      .timeline-bottom {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 6mm;
      }
      .timeline-note {
        padding: 4.4mm;
        display: grid;
        gap: 1.6mm;
      }
      .timeline-note p { font-size: 8.2pt; line-height: 1.38; }
      .quote-slice {
        padding: 4.8mm;
        display: grid;
        gap: 2mm;
      }
      .quote-slice blockquote {
        font-size: 11.5pt;
        line-height: 1.22;
      }
      .closing { display: grid; align-items: end; }
      .closing .cover-overlay {
        background:
          linear-gradient(180deg, rgba(255, 249, 246, 0.26) 0%, rgba(255, 249, 246, 0.82) 56%, rgba(255, 249, 246, 0.96) 100%);
      }
      .closing-shell {
        position: relative;
        z-index: 2;
        display: grid;
        gap: 6mm;
        max-width: 102mm;
      }
      .closing-shell blockquote {
        font-size: 26pt;
        line-height: 1.06;
      }
      .closing-shell p { font-size: 9.8pt; }
    </style>
  </head>
  <body>
    <main class="book">
      <section class="page cover" id="spread-cover">
        <img class="page-art page-art--cover" src="${payload.cover_image}" alt="" />
        <div class="cover-overlay"></div>
        <div class="shell">
          <div class="cover-grid">
            <div class="cover-title">
              <span class="section-kicker">${escapeHtml(payload.subtitle)}</span>
              <h1>${escapeHtml(payload.title)}</h1>
              <p>${escapeHtml(payload.tagline)}</p>
            </div>
            <div class="cover-metrics">${heroMetrics}</div>
          </div>
        </div>
        <div class="cover-footer shell">
          <p>${escapeHtml(payload.time_span)}</p>
          <div>
            <strong>${escapeHtml(payload.participants.join(" + "))}</strong>
            <p>${escapeHtml(payload.keepsake_line)}</p>
          </div>
        </div>
      </section>

      <section class="page" id="spread-overview">
        <div class="page-number">1</div>
        <div class="page-grid">
          <div class="overview-top">
            <div class="overview-hero">
              <span class="section-kicker">At a glance</span>
              <h2>The whole shape, held in one place</h2>
              <p>A shorter book, but with the parts that still feel alive.</p>
            </div>
            <div class="overview-panels glass-card panel">
              <div class="chart-title">
                <span class="section-kicker section-kicker--tiny">Archive span</span>
                <h3>${escapeHtml(String(payload.signature_metrics.headline.longest_daily_streak))} days in a row</h3>
                <p>${escapeHtml(formatCompact(payload.signature_metrics.headline.total_messages))} messages across ${escapeHtml(String(payload.message_frequency.summary.active_days))} active days.</p>
              </div>
              <div class="dense-stack">
                <div class="comparison-copy"><span>most active day</span><strong>${escapeHtml(formatIsoDate(payload.signature_metrics.headline.most_active_day.day_key))}</strong></div>
                <div class="comparison-copy"><span>most active month</span><strong>${escapeHtml(payload.signature_metrics.headline.most_active_month.month_key)}</strong></div>
                <div class="comparison-copy"><span>late-night share</span><strong>${escapeHtml(formatPercent(payload.signature_metrics.headline.late_night_percentage))}</strong></div>
              </div>
            </div>
          </div>
          <div class="duo-grid">
            <article class="chart-box glass-card">
              <div class="chart-title">
                <span class="section-kicker section-kicker--tiny">Emotion</span>
                <h3>Weekly intensity</h3>
              </div>
              ${createAreaChart(payload.emotional_arc, 520, 220)}
            </article>
            <article class="chart-box glass-card">
              <div class="chart-title">
                <span class="section-kicker section-kicker--tiny">Share split</span>
                <h3>Together, then by side</h3>
              </div>
              ${createDonutSplitChart(dashboardParticipants, 220)}
              <div class="legend-row">${participantLegends}</div>
            </article>
          </div>
        </div>
      </section>

      <section class="page" id="spread-time">
        <div class="page-number">2</div>
        <div class="page-grid">
          <article class="chart-box glass-card">
            <div class="chart-title">
              <span class="section-kicker">Time</span>
              <h2>When the archive was most alive</h2>
            </div>
            ${createSplitMonthlyChart(payload.dashboard.time_patterns.monthly_split, participantIds, 620, 170)}
            <div class="legend-row">${participantLegends}</div>
          </article>
          <div class="duo-grid">
            <article class="chart-box glass-card">
              <div class="chart-title">
                <span class="section-kicker section-kicker--tiny">Hours</span>
                <h3>When the day opened up</h3>
              </div>
              ${createHeatmapSvg(payload.message_frequency, 520)}
            </article>
            <article class="stack">
              <article class="chart-box glass-card">
                <div class="chart-title">
                  <span class="section-kicker section-kicker--tiny">After midnight</span>
                  <h3>The night kept showing up</h3>
                </div>
                ${createLateNightGauge(payload.signature_metrics.headline.late_night_percentage, 170)}
              </article>
              <article class="glass-card panel">
                <span class="section-kicker section-kicker--tiny">Signals</span>
                <div class="comparison-strip">
                  <div class="comparison-row">
                    <div class="comparison-copy"><span>support moments</span><strong>${escapeHtml(formatCompact(payload.signature_metrics.headline.support_moments_count))}</strong></div>
                    <div class="comparison-track"><i class="comparison-fill" style="width:72%"></i></div>
                  </div>
                  <div class="comparison-row">
                    <div class="comparison-copy"><span>conflict / repair cycles</span><strong>${escapeHtml(String(payload.signature_metrics.headline.conflict_repair_cycles))}</strong></div>
                    <div class="comparison-track"><i class="comparison-fill comparison-fill--soft" style="width:38%"></i></div>
                  </div>
                </div>
              </article>
            </article>
          </div>
        </div>
      </section>

      <section class="page" id="spread-voices">
        <img class="page-art page-art--ambient" src="${payload.chapter_image}" alt="" />
        <div class="page-number">3</div>
        <div class="page-grid">
          <div class="overview-hero">
            <span class="section-kicker">The two voices</span>
            <h2>How each one shaped the archive</h2>
          </div>
          <div class="duo-grid">
            <div class="stack">${participantSignatureCards}</div>
            <div class="stack">
              <article class="glass-card panel">
                <div class="chart-title">
                  <span class="section-kicker section-kicker--tiny">Conversation openers</span>
                  <h3>Who started the rhythm more often</h3>
                </div>
                <div class="comparison-strip">
                  ${dashboardParticipants
                    .map((participant, index) => `
                      <div class="comparison-row">
                        <div class="comparison-copy"><span>${escapeHtml(participant.label)}</span><strong>${escapeHtml(String(participant.session_opener_count))}</strong></div>
                        <div class="comparison-track"><i class="comparison-fill ${index === 1 ? "comparison-fill--soft" : ""}" style="width:${participant.session_opener_share.toFixed(1)}%"></i></div>
                      </div>
                    `)
                    .join("")}
                </div>
              </article>
              <div class="mini-grid">${detectiveCards}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="page" id="spread-mood">
        <div class="page-number">4</div>
        <div class="page-grid">
          <div class="duo-grid">
            <article class="glass-card panel">
              <div class="chart-title">
                <span class="section-kicker">Mood</span>
                <h2>What the archive leaned toward</h2>
              </div>
              <div class="dense-stack">${emotionRows}</div>
            </article>
            <article class="glass-card panel">
              <div class="chart-title">
                <span class="section-kicker">Shapes</span>
                <h2>How the conversations tended to move</h2>
              </div>
              <div class="dense-stack">${archetypeRows}</div>
            </article>
          </div>
          <div class="duo-grid">
            <article class="chart-box glass-card">
              <div class="chart-title">
                <span class="section-kicker section-kicker--tiny">Support / conflict / repair</span>
                <h3>The signal line</h3>
              </div>
              ${createSignalTrendChart(payload.dashboard.emotion_patterns.signal_trend, 520, 180)}
            </article>
            <div class="stack">${signalCards}</div>
          </div>
        </div>
      </section>

      <section class="page" id="spread-timeline">
        <div class="page-number">5</div>
        <div class="page-grid timeline-layout">
          <article class="chart-box glass-card">
            <div class="chart-title">
              <span class="section-kicker">Timeline</span>
              <h2>The phases, without the clutter</h2>
            </div>
            ${createChapterTimeline(payload.chapters, 620, 210)}
          </article>
          <div class="timeline-bottom">
            <div class="stack">${milestoneCards}</div>
            <div class="stack">${sessionCards}</div>
          </div>
        </div>
      </section>

      <section class="page" id="spread-themes">
        <img class="page-art page-art--ambient" src="${payload.lens_image}" alt="" />
        <div class="page-number">6</div>
        <div class="page-grid">
          <article class="chart-box glass-card">
            <div class="chart-title">
              <span class="section-kicker">Themes</span>
              <h2>The echoes that kept returning</h2>
            </div>
            ${createLensGarden(payload.lenses, 620, 220)}
            <div class="topic-row">${topicPills}</div>
          </article>
          <div class="duo-grid">
            <article class="glass-card panel">
              <span class="section-kicker section-kicker--tiny">Memory cloud</span>
              <div class="legend-row">${motifCloud}</div>
            </article>
            <div class="stack">${memorySnippets}</div>
          </div>
        </div>
      </section>

      <section class="page closing" id="spread-closing">
        <img class="page-art page-art--closing" src="${payload.cover_image}" alt="" />
        <div class="cover-overlay"></div>
        <div class="closing-shell">
          <span class="section-kicker">${escapeHtml(payload.presentation_mode === "gift" ? "Still yours" : "Still here")}</span>
          ${
            payload.closing_quote
              ? `<blockquote>&ldquo;${escapeHtml(cleanDisplayText(buildExcerpt(payload.closing_quote.excerpt, 92)))}&rdquo;</blockquote>`
              : `<blockquote>The shape stays, even after the days themselves start to blur.</blockquote>`
          }
          <p>${escapeHtml(payload.keepsake_line)}</p>
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

