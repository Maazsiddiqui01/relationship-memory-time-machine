import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import {
  buildExcerpt,
  cleanDisplayText,
  curateTopicClusters,
  isLowValueText,
} from "@/lib/curation";
import { loadThemesData } from "@/lib/data";

export default async function ThemesPage() {
  const { topicClusters, phraseMotifs, insideJokes } = await loadThemesData();
  const visibleClusters = curateTopicClusters(topicClusters, 6);
  const visibleMotifs = phraseMotifs.slice(0, 18);

  return (
    <div className="section-stack">
      <Reveal>
        <section className="route-hero">
          <span className="hero-kicker">Themes</span>
          <h1>The words that kept finding their way back.</h1>
          <p>Little phrases, recurring ideas, and the language that slowly became part of the archive.</p>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <SectionHeading
            eyebrow="Topic clusters"
            title="Where the conversation kept returning"
            description="Themes, motif chips, and the things we circled back to without meaning to."
            align="left"
          />
          <div className="topic-grid">
            {visibleClusters.map((cluster) => (
              <article key={cluster.topic_id} className="topic-card topic-card--motif">
                <div className="milestone-head">
                  <h3>{cluster.label.replace(/_/gu, " ")}</h3>
                  <span className="tag">{cluster.count.toLocaleString()} msgs</span>
                </div>
                <div className="motif-cloud">
                  {cluster.representative_quotes
                    .map((quote) => cleanDisplayText(quote))
                    .filter((quote) => quote && !isLowValueText(quote))
                    .slice(0, 3)
                    .map((quote) => (
                      <span key={quote} className="motif-chip">
                        {buildExcerpt(quote, 38)}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="panel-card">
            <div className="panel-topline">
              <span>Phrase motifs</span>
              <strong>Repeated bits of language</strong>
            </div>
            <div className="motif-cloud">
              {visibleMotifs.map((motif) => (
                <span key={motif.motif_id} className="motif-chip">
                  {cleanDisplayText(motif.label)}
                  <small>{motif.count}</small>
                </span>
              ))}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-topline">
              <span>Inside jokes</span>
              <strong>Playful recurring references</strong>
            </div>
            {insideJokes.length ? (
              <div className="milestone-list">
                {insideJokes.slice(0, 6).map((joke) => (
                  <article key={joke.inside_joke_id} className="milestone-card">
                    <h3>{cleanDisplayText(joke.label)}</h3>
                    <p>{buildExcerpt(cleanDisplayText(joke.summary), 110)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nothing strong enough earned a place here yet, and that restraint is better than forcing something ordinary.</p>
              </div>
            )}
          </article>
        </section>
      </Reveal>
    </div>
  );
}
