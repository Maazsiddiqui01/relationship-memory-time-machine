import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmotionArcChart } from "@/components/emotion-arc-chart";
import { HeatmapGrid } from "@/components/heatmap-grid";
import { MonthlyVolumeChart } from "@/components/monthly-volume-chart";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import {
  buildExcerpt,
  curateHighlights,
  curateMilestones,
  differentiateMilestoneTitles,
  decorateChapters,
  getMonthlyVolume,
  summarizeChapter,
} from "@/lib/curation";
import { loadHomepageData } from "@/lib/data";
import { formatCompact } from "@/lib/format";
import { loadTopStoryLenses } from "@/lib/story-lenses";

export default async function HomePage() {
  const {
    signatureMetrics,
    emotionTimeline,
    messageFrequency,
    highlights,
    milestones,
    chapters,
    participants,
    dashboardInsights,
  } =
    await loadHomepageData();
  const storyLenses = await loadTopStoryLenses(6);

  const featuredHighlights = curateHighlights(highlights, {
    limit: 2,
    maxChars: 150,
    maxPerChapter: 1,
    maxPerSender: 1,
  });
  const featuredMilestones = differentiateMilestoneTitles(
    curateMilestones(milestones, {
      limit: 3,
      maxPerChapter: 1,
      maxSameTitle: 1,
      allowCareerSignals: true,
    }),
  );
  const monthlyVolume = getMonthlyVolume(messageFrequency).slice(-18);
  const participantNames = participants.map((participant) => participant.label.split(" ")[0]).join(" and ");
  const primaryReader =
    participants.find((participant) => /durriya|durr/i.test(participant.label))?.label.split(" ")[0] ?? "Durriya";
  const displayChapters = decorateChapters(chapters).slice(0, 6);
  const previewInsights = [
    "who_sent_more",
    "who_replied_faster",
    "most_active_month",
    "highest_support_stretch",
  ]
    .map((recordId) =>
      dashboardInsights.detective_records.find((record) => record.record_id === recordId),
    )
    .filter(
      (record): record is (typeof dashboardInsights.detective_records)[number] => Boolean(record),
    );

  return (
    <div className="section-stack">
      <Reveal>
        <section className="hero-stage">
          <Image
            src="/images/hero.png"
            alt="Atmospheric warm texture"
            fill
            priority
            className="hero-bg-image"
          />
          <div className="hero-copy">
            <span className="hero-kicker">For {primaryReader}</span>
            <h1>{participantNames}</h1>
            <p>A softer way to revisit us: the moods, the late nights, the turns, and the little things that became ours.</p>
          </div>

          <div className="hero-stat-strip">
            <article className="stat-chip">
              <span>Archive span</span>
              <strong>
                {chapters[0]?.start_timestamp.slice(0, 10)} to {chapters.at(-1)?.end_timestamp.slice(0, 10)}
              </strong>
            </article>
            <article className="stat-chip">
              <span>Total messages</span>
              <strong>{signatureMetrics.headline.total_messages.toLocaleString()}</strong>
            </article>
            <article className="stat-chip">
              <span>Longest streak</span>
              <strong>{signatureMetrics.headline.longest_daily_streak} days</strong>
            </article>
            <article className="stat-chip">
              <span>Late-night share</span>
              <strong>{signatureMetrics.headline.late_night_percentage.toFixed(1)}%</strong>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Overview"
            title="Start where the whole shape becomes visible"
            description="You should be able to feel the story first, then choose where you want to step closer."
            align="left"
          />
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Emotional arc</span>
                <strong>Weekly intensity</strong>
              </div>
              <EmotionArcChart points={emotionTimeline.slice(-52)} />
            </article>
            <article className="panel-card">
              <div className="panel-topline">
                <span>Message volume</span>
                <strong>Monthly rhythm</strong>
              </div>
              <MonthlyVolumeChart points={monthlyVolume} />
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="panel-card">
            <div className="panel-topline">
              <span>Conversation pattern</span>
              <strong>When the archive was most alive</strong>
            </div>
            <HeatmapGrid bins={messageFrequency.heatmap_bins} />
          </article>

          <article className="panel-card panel-card--portal">
            <div className="panel-topline">
              <span>Insight preview</span>
              <strong>If you want the detective version of us</strong>
            </div>
            <div className="insight-preview-grid">
              {previewInsights.map((record) => (
                <article key={record.record_id} className="insight-tile">
                  <span>{record.label}</span>
                  <strong>{record.value}</strong>
                  <p>{record.detail}</p>
                </article>
              ))}
            </div>
            <Link href={"/dashboard/" as Route} className="portal-card" prefetch={false}>
              <div>
                <span className="hero-kicker">Dashboard</span>
                <h3>Open the deeper board</h3>
              </div>
              <p>Who chased harder, who stayed up later, which months went loudest, and where the warmth kept returning.</p>
            </Link>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Interactive lenses"
            title="Choose a feeling and step inside it"
            description="Each lens lets you revisit us through one mood at a time instead of another wall of explanation."
            align="left"
          />
          <div className="lens-grid">
            {storyLenses.map((lens) => (
              <Link key={lens.slug} href={`/lenses/${lens.slug}` as Route} className="lens-card" prefetch={false}>
                <span className="eyebrow-inline">{formatCompact(lens.message_count)} tagged messages</span>
                <h3>{lens.title}</h3>
                <p>{lens.teaser}</p>
                <div className="lens-card-footer">
                  <span className="tag">{Math.round(lens.share_of_archive * 100)}% of archive</span>
                  <span className="tag">{lens.dominant_emotion}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Chapters"
            title="The six phases of us"
            description="Think of these as chapter covers you can open whenever you want to sit with a different version of us."
            align="left"
          />
          <div className="chapter-preview-grid">
            {displayChapters.map((chapter) => (
              <Link
                key={chapter.chapter_id}
                href={`/chapters/${chapter.slug}` as Route}
                className="chapter-preview-card"
                prefetch={false}
              >
                <span className="eyebrow-inline">{chapter.phase_label} / {chapter.start_timestamp.slice(0, 10)}</span>
                <h3>{chapter.display_title}</h3>
                <p>{summarizeChapter(chapter)}</p>
                <div className="tag-row">
                  <span className="tag">{chapter.dominant_emotion}</span>
                  <span className="tag">{chapter.message_count.toLocaleString()} msgs</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <div>
            <SectionHeading
              eyebrow="Memory cards"
              title="A few little keepsakes"
              description="Just enough to feel it again, without letting the page turn into a transcript."
              align="left"
            />
            <div className="memory-grid">
              {featuredHighlights.map((highlight) => (
                <article key={highlight.highlight_id} className="memory-card">
                  <blockquote>{highlight.excerpt}</blockquote>
                  <div className="memory-meta">
                    <span>{highlight.sender_label ?? "System"}</span>
                    <span>{highlight.emotion_label}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading
              eyebrow="Milestones"
              title="The turns that changed everything a little"
              description="Short markers across the story, kept brief on purpose."
              align="left"
            />
            <div className="milestone-list">
              {featuredMilestones.map((milestone) => (
                <article key={milestone.milestone_id} className="milestone-card">
                  <div className="milestone-head">
                    <h3>{milestone.display_title}</h3>
                    <span className="tag">{milestone.milestone_type}</span>
                  </div>
                  <p>{milestone.short_summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="quiet-band">
          <p>
            {buildExcerpt(
              "If you want the full picture, the dashboard tracks the patterns, the timeline keeps the order, and the lenses let one feeling take over for a while.",
              132,
            )}
          </p>
          <div className="pill-row">
            <Link href={"/dashboard/" as Route} className="pill" prefetch={false}>
              Open dashboard
            </Link>
            <Link href="/timeline" className="pill" prefetch={false}>
              Explore timeline
            </Link>
            <Link href="/lenses/affection" className="pill" prefetch={false}>
              Enter a lens
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
