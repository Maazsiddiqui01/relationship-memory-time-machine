import { EmotionArcChart } from "@/components/emotion-arc-chart";
import { HeatmapGrid } from "@/components/heatmap-grid";
import { MonthlyVolumeChart } from "@/components/monthly-volume-chart";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { getMonthlyVolume } from "@/lib/curation";
import { loadPatternsData } from "@/lib/data";
import { formatCompact } from "@/lib/format";
import Link from "next/link";
import type { Route } from "next";

export default async function PatternsPage() {
  const { messageFrequency, signatureMetrics, emotionTimeline, dashboardInsights } = await loadPatternsData();
  const monthlyVolume = getMonthlyVolume(messageFrequency).slice(-18);
  const previewRecords = dashboardInsights.detective_records.slice(0, 3);

  return (
    <div className="section-stack">
      <Reveal>
        <section className="route-hero">
          <span className="hero-kicker">Patterns</span>
          <h1>The habits hidden inside us.</h1>
          <p>A lighter read of our rhythm before the full detective board.</p>
        </section>
      </Reveal>

      <Reveal>
        <section className="metrics-band">
          <article className="hero-metric">
            <span>Avg daily</span>
            <strong>{Math.round(signatureMetrics.headline.average_daily_messages)}</strong>
          </article>
          <article className="hero-metric">
            <span>Longest streak</span>
            <strong>{signatureMetrics.headline.longest_daily_streak}</strong>
          </article>
          <article className="hero-metric">
            <span>Late night</span>
            <strong>{signatureMetrics.headline.late_night_percentage.toFixed(1)}%</strong>
          </article>
          <article className="hero-metric">
            <span>Support moments</span>
            <strong>{formatCompact(signatureMetrics.headline.support_moments_count)}</strong>
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="panel-card">
            <div className="panel-topline">
              <span>Heatmap</span>
              <strong>When conversation peaks</strong>
            </div>
            <HeatmapGrid bins={messageFrequency.heatmap_bins} />
          </article>
          <article className="panel-card">
            <div className="panel-topline">
              <span>Volume</span>
              <strong>Month by month intensity</strong>
            </div>
            <MonthlyVolumeChart points={monthlyVolume} />
          </article>
        </section>
      </Reveal>

      <Reveal>
        <section className="dashboard-grid dashboard-grid--two">
          <article className="panel-card">
            <div className="panel-topline">
              <span>Emotional movement</span>
              <strong>Intensity across the archive</strong>
            </div>
            <EmotionArcChart points={emotionTimeline} />
          </article>

          <article className="panel-card panel-card--portal">
            <div className="panel-topline">
              <span>Dashboard preview</span>
              <strong>Go deeper into the signals</strong>
            </div>
            <div className="insight-preview-grid">
              {previewRecords.map((record) => (
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
              <p>Participant splits, night habits, emotional shifts, and the sharper little facts hiding inside all of this.</p>
            </Link>
          </article>
        </section>
      </Reveal>
    </div>
  );
}
