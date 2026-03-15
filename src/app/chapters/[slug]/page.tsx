import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import {
  buildExcerpt,
  curateHighlights,
  curateMilestones,
  decorateChapters,
  differentiateMilestoneTitles,
  summarizeChapter,
} from "@/lib/curation";
import { loadAllChapters, loadChapterData } from "@/lib/data";
import { formatCompact, formatIsoDate } from "@/lib/format";

type ChapterPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const chapters = await loadAllChapters();
  return chapters.map((chapter) => ({
    slug: chapter.slug,
  }));
}

function getPhaseNumber(chapterId: string): string {
  return chapterId.split("_").pop()?.replace(/^0+/, "") || chapterId;
}

function getDurationInDays(startTimestamp: string, endTimestamp: string): number {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  return Math.max(1, Math.round((end - start) / 86400000));
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { slug } = await params;
  const { chapter, highlights, milestones } = await loadChapterData(slug);
  const allChapters = decorateChapters(await loadAllChapters());

  if (!chapter) {
    notFound();
  }

  const curatedHighlights = curateHighlights(highlights, {
    limit: 7,
    maxChars: 170,
    maxPerChapter: 7,
    maxPerSender: 4,
  });
  const curatedMilestones = differentiateMilestoneTitles(
    curateMilestones(milestones, {
      limit: 4,
      maxPerChapter: 4,
      maxSameTitle: 2,
      allowCareerSignals: true,
    }),
  );

  const leadHighlight = curatedHighlights[0] ?? null;
  const supportingHighlights = curatedHighlights.slice(1, 5);
  const durationDays = getDurationInDays(chapter.start_timestamp, chapter.end_timestamp);
  const leadTags = leadHighlight
    ? [...new Set([leadHighlight.emotion_label, ...leadHighlight.archetype_tags.slice(0, 2).map((tag) => tag.replace(/_/gu, " "))])]
    : [];
  const displayChapter = allChapters.find((entry) => entry.chapter_id === chapter.chapter_id) ?? {
    ...chapter,
    display_title: chapter.title,
    phase_label: `Phase ${getPhaseNumber(chapter.chapter_id)}`,
    occurrence_index: 1,
  };

  return (
    <div className="section-stack">
      <Reveal>
        <section className="chapter-cover">
          <Image
            src="/images/chapter-motif.png"
            alt="Delicate chapter texture"
            fill
            priority
            className="chapter-bg-image"
          />
          <div className="chapter-cover-copy">
            <span className="hero-kicker">Chapter {getPhaseNumber(chapter.chapter_id)}</span>
            <h1>{displayChapter.display_title}</h1>
            <p>{`Durriya, this was one version of us. ${summarizeChapter(displayChapter)}`}</p>
          </div>

          <div className="hero-stat-strip hero-stat-strip--tight">
            <article className="stat-chip">
              <span>Time span</span>
              <strong>
                {formatIsoDate(chapter.start_timestamp)} to {formatIsoDate(chapter.end_timestamp)}
              </strong>
            </article>
            <article className="stat-chip">
              <span>Messages</span>
              <strong>{formatCompact(chapter.message_count)}</strong>
            </article>
            <article className="stat-chip">
              <span>Duration</span>
              <strong>{durationDays} days</strong>
            </article>
            <article className="stat-chip">
              <span>Dominant tone</span>
              <strong>{chapter.dominant_emotion}</strong>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="lead-memory-card">
            <div className="panel-topline">
              <span>Lead memory</span>
              <strong>One moment that holds the phase</strong>
            </div>
            {leadHighlight ? (
              <>
                <blockquote>{leadHighlight.excerpt}</blockquote>
                <div className="memory-meta">
                  <span>{leadHighlight.sender_label ?? "System"}</span>
                  <span>{formatIsoDate(leadHighlight.timestamp_local)}</span>
                </div>
                <div className="tag-row">
                  {leadTags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="supporting-copy">
                Nothing here cleared the quality bar for this phase, and leaving the space quieter feels better than
                forcing the wrong memory into it.
              </p>
            )}
          </article>

          <article className="panel-card">
            <div className="panel-topline">
              <span>Phase signature</span>
              <strong>What defines this chapter</strong>
            </div>
            <div className="metric-stack">
              <div className="metric-line">
                <span>Narrative segments</span>
                <strong>{chapter.narrative_segment_ids.length}</strong>
              </div>
              <div className="metric-line">
                <span>Milestones</span>
                <strong>{chapter.milestone_ids.length}</strong>
              </div>
              <div className="metric-line">
                <span>Highlights kept</span>
                <strong>{curatedHighlights.length}</strong>
              </div>
            </div>
            <div className="tag-row tag-row--left">
              {chapter.dominant_archetypes.slice(0, 4).map((tag) => (
                <span key={tag} className="tag">
                  {tag.replace(/_/gu, " ")}
                </span>
              ))}
            </div>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <div>
            <SectionHeading
              eyebrow="Memories"
              title="A few fragments from this chapter"
              description="Kept short on purpose, so the feeling stays intact."
              align="left"
            />
            <div className="memory-grid">
              {supportingHighlights.map((highlight) => (
                <article key={highlight.highlight_id} className="memory-card">
                  <blockquote>{highlight.excerpt}</blockquote>
                  <div className="memory-meta">
                    <span>{highlight.sender_label ?? "System"}</span>
                    <span>{formatIsoDate(highlight.timestamp_local)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading
              eyebrow="Milestones"
              title="The shifts inside this phase"
              description="Just enough context to remember what changed."
              align="left"
            />
            <div className="milestone-list">
              {curatedMilestones.map((milestone) => (
                <article key={milestone.milestone_id} className="milestone-card">
                  <div className="milestone-head">
                    <h3>{milestone.display_title}</h3>
                    <span className="tag">{milestone.milestone_type}</span>
                  </div>
                  <p>{milestone.short_summary}</p>
                  {milestone.display_quote ? (
                    <p className="milestone-quote">{milestone.display_quote}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="quiet-band">
          <p>When you want to zoom back out, the timeline keeps the order, moments keeps the keepsakes, and patterns shows the rhythm.</p>
          <div className="pill-row">
            <Link href="/timeline" className="pill" prefetch={false}>
              Back to timeline
            </Link>
            <Link href="/moments" className="pill" prefetch={false}>
              Open moments
            </Link>
            <Link href="/patterns" className="pill" prefetch={false}>
              View patterns
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
