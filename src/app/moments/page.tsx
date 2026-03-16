import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { curateHighlights, curateMilestones, differentiateMilestoneTitles } from "@/lib/curation";
import { loadMomentsData } from "@/lib/data";
import { formatIsoDate } from "@/lib/format";
import { addressReader, deriveProjectProfile } from "@/lib/project-profile";

export default async function MomentsPage() {
  const { milestones, highlights, participants } = await loadMomentsData();
  const profile = deriveProjectProfile(participants);
  const memoryCards = curateHighlights(highlights, { limit: 12, maxChars: 155, maxPerChapter: 2 });
  const visibleMilestones = differentiateMilestoneTitles(
    curateMilestones(milestones, {
      limit: 8,
      maxPerChapter: 2,
      maxSameTitle: 2,
      allowCareerSignals: true,
    }),
  );

  return (
    <div className="section-stack">
      <Reveal>
        <section className="route-hero">
          <span className="hero-kicker">Memory Gallery</span>
          <h1>The pieces worth keeping close.</h1>
          <p>{addressReader(profile.primaryReader, "this page is meant to feel like a small keepsake box: brief, vivid, and easy to linger in.")}</p>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Highlights"
            title="Little cards worth lingering on"
            description="Short excerpts only, so the feeling stays clear."
            align="left"
          />
          <div className="memory-grid memory-grid--wide">
            {memoryCards.map((highlight) => (
              <article key={highlight.highlight_id} className="memory-card">
                <blockquote>{highlight.excerpt}</blockquote>
                <div className="memory-meta">
                  <span>{highlight.sender_label ?? "System"}</span>
                  <span>{formatIsoDate(highlight.timestamp_local)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Milestones"
            title="The bigger turns"
            description="Just enough context to remember what shifted."
            align="left"
          />
          <div className="milestone-list milestone-list--grid">
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
        </section>
      </Reveal>
    </div>
  );
}
