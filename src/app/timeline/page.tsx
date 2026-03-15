import type { Route } from "next";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { curateMilestones, decorateChapters, differentiateMilestoneTitles, summarizeChapter } from "@/lib/curation";
import { loadTimelineData } from "@/lib/data";
import { formatIsoDate } from "@/lib/format";

export default async function TimelinePage() {
  const { chapters, milestones } = await loadTimelineData();
  const displayChapters = decorateChapters(chapters);
  const visibleMilestones = differentiateMilestoneTitles(
    curateMilestones(milestones, {
      limit: 12,
      maxPerChapter: 2,
      maxSameTitle: 2,
      allowCareerSignals: true,
    }).sort((left, right) => left.start_timestamp.localeCompare(right.start_timestamp)),
  );

  return (
    <div className="section-stack">
      <Reveal>
        <section className="route-hero">
          <span className="hero-kicker">Timeline</span>
          <h1>The story, in the order you lived it.</h1>
          <p>
            Durriya, this is the clearer path through it all: the phases, the turns, and the moments that quietly
            changed the tone.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Chapters"
            title="The story in sequence"
            description="Use these as anchors whenever you want to move through us phase by phase."
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
                <span className="eyebrow-inline">
                  {chapter.phase_label} / {formatIsoDate(chapter.start_timestamp)}
                </span>
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
        <section>
          <SectionHeading
            eyebrow="Milestones"
            title="The turns across the full arc"
            description="These markers stay spread across the whole timeline, so the later chapters do not disappear behind the early intensity."
            align="left"
          />
          <div className="timeline-rail">
            {visibleMilestones.map((milestone) => (
              <article key={milestone.milestone_id} className="timeline-entry">
                <span className="timeline-dot" />
                <div className="timeline-copy">
                  <div className="milestone-head">
                    <h3>{milestone.display_title}</h3>
                    <span className="tag">{milestone.milestone_type}</span>
                  </div>
                  <p>{milestone.short_summary}</p>
                  <span className="eyebrow-inline">{formatIsoDate(milestone.start_timestamp)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
