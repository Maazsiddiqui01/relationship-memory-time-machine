import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { buildExcerpt, differentiateMilestoneTitles, humanizeArchetypeLabel, summarizeChapter } from "@/lib/curation";
import { formatCompact, formatIsoDate } from "@/lib/format";
import { listStoryLensSlugs, loadStoryLens } from "@/lib/story-lenses";

type LensPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return listStoryLensSlugs().map((slug) => ({ slug }));
}

export default async function LensPage({ params }: LensPageProps) {
  const { slug } = await params;
  const lens = await loadStoryLens(slug);

  if (!lens) {
    notFound();
  }

  const visibleMilestones = differentiateMilestoneTitles(lens.milestones);

  return (
    <div className="section-stack">
      <Reveal>
        <section className="lens-hero">
          <Image
            src="/images/lens-motif.png"
            alt="Emotional lens texture"
            fill
            priority
            className="lens-bg-image"
          />
          <div className="lens-hero-copy">
            <span className="hero-kicker">A feeling, isolated</span>
            <h1>{lens.title}</h1>
            <p>{lens.teaser}</p>
          </div>

          <div className="hero-stat-strip">
            <article className="stat-chip">
              <span>Tagged messages</span>
              <strong>{formatCompact(lens.message_count)}</strong>
            </article>
            <article className="stat-chip">
              <span>Archive share</span>
              <strong>{Math.round(lens.share_of_archive * 100)}%</strong>
            </article>
            <article className="stat-chip">
              <span>Dominant tone</span>
              <strong>{lens.dominant_emotion}</strong>
            </article>
            <article className="stat-chip">
              <span>Visual mood</span>
              <strong>{lens.mood}</strong>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="panel-card">
            <div className="panel-topline">
              <span>Mood map</span>
              <strong>How this lens tends to feel</strong>
            </div>
            <div className="lens-emotion-list">
              {lens.top_emotions.map((emotion) => (
                <div key={emotion.label} className="lens-emotion-row">
                  <span>{emotion.label}</span>
                  <strong>{formatCompact(emotion.count)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-topline">
              <span>Recurring motifs</span>
              <strong>Bits of language attached to this mode</strong>
            </div>
            <div className="motif-cloud">
              {lens.motifs.length ? (
                lens.motifs.map((motif) => (
                  <span key={motif.motif_id} className="motif-chip">
                    {motif.label}
                    <small>{motif.count}</small>
                  </span>
                ))
              ) : (
                <span className="motif-chip">{humanizeArchetypeLabel(lens.archetype)}</span>
              )}
            </div>
            <div className="tag-row tag-row--left">
              {lens.top_topics.map((topic) => (
                <span key={topic.label} className="tag">
                  {topic.label.replace(/_/gu, " ")}
                </span>
              ))}
            </div>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Touched chapters"
            title="Where this feeling becomes unmistakable"
            description="These are the phases where this side of the archive came through most clearly."
            align="left"
          />
          <div className="lens-grid">
            {lens.chapters.map((chapter) => (
              <Link
                key={chapter.chapter_id}
                href={`/chapters/${chapter.slug}` as Route}
                className="lens-card"
                prefetch={false}
              >
                <span className="eyebrow-inline">{chapter.phase_label}</span>
                <h3>{chapter.display_title}</h3>
                <p>{buildExcerpt(summarizeChapter(chapter), 96)}</p>
                <div className="lens-card-footer">
                  <span className="tag">{chapter.lens_count} signals</span>
                  <span className="tag">{formatIsoDate(chapter.start_timestamp)}</span>
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
              eyebrow="Selected moments"
              title="A few flashes of it"
              description="Enough to feel the mood again, without turning this into a transcript."
              align="left"
            />
            <div className="memory-grid">
              {lens.highlights.map((highlight) => (
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
            eyebrow="Story beats"
            title="Where this feeling changed the story"
            description="These markers keep the mood tied to the larger arc of the story."
            align="left"
          />
            <div className="milestone-list">
              {visibleMilestones.map((milestone) => (
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
            Step back whenever you want. The story page widens out again, and each lens is just one way of looking at
            the archive for a while.
          </p>
          <div className="pill-row">
            <Link href="/" className="pill" prefetch={false}>
              Back to story
            </Link>
            <Link href="/timeline" className="pill" prefetch={false}>
              Open timeline
            </Link>
            <Link href="/moments" className="pill" prefetch={false}>
              View moments
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
