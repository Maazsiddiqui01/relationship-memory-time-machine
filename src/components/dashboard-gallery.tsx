"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  HeartHandshake,
  MoonStar,
  TimerReset,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardInsights, SignatureMetrics } from "../../pipeline/schemas.js";
import { decorateRepeatedTitles, humanizeArchetypeLabel } from "@/lib/curation";
import { formatCompact, formatIsoDate, formatMonthYear } from "@/lib/format";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";

const PARTICIPANT_COLORS = ["#d88da5", "#efb6c4"];
const MIX_COLORS = ["#d88da5", "#efb6c4", "#f6cfd8", "#9f8790", "#c66c82", "#f4e4e8"];

type DashboardGalleryProps = {
  insights: DashboardInsights;
  signatureMetrics: SignatureMetrics;
  primaryReader: string;
};

function tooltipStyle() {
  return {
    borderRadius: "18px",
    border: "1px solid rgba(122,105,96,0.14)",
    background: "rgba(255,250,247,0.96)",
  };
}

function formatRecordRoute(route: string | null): Route {
  return (route ?? "/dashboard/") as Route;
}

export function DashboardGallery({ insights, signatureMetrics, primaryReader }: DashboardGalleryProps) {
  const [scope, setScope] = useState<"overall" | string>("overall");
  const selectedParticipant =
    scope === "overall"
      ? null
      : insights.participants.find((participant) => participant.participant_id === scope) ?? null;
  const scopeParticipants = selectedParticipant ? [selectedParticipant] : insights.participants;

  const monthlySeries = insights.time_patterns.monthly_split.map((month) => ({
    month_key: month.month_key,
    total_messages: month.total_messages,
    late_night_count: month.late_night_count,
    ...Object.fromEntries(
      insights.participants.map((participant) => [
        participant.participant_id,
        month.participant_counts[participant.participant_id] ?? 0,
      ]),
    ),
  }));

  const weekdaySeries = insights.time_patterns.weekday_distribution.map((day) => ({
    label: day.label,
    total_messages: day.total_messages,
    ...Object.fromEntries(
      insights.participants.map((participant) => [
        participant.participant_id,
        day.participant_counts[participant.participant_id] ?? 0,
      ]),
    ),
  }));

  const hourSeries = insights.time_patterns.hour_distribution.map((hour) => ({
    label: hour.label,
    total_messages: hour.total_messages,
    ...Object.fromEntries(
      insights.participants.map((participant) => [
        participant.participant_id,
        hour.participant_counts[participant.participant_id] ?? 0,
      ]),
    ),
  }));

  const lateNightSeries = insights.time_patterns.late_night_trend.map((month) => ({
    month_key: month.month_key,
    share: month.late_night_share,
    ...Object.fromEntries(
      insights.participants.map((participant) => [
        participant.participant_id,
        month.participant_counts[participant.participant_id] ?? 0,
      ]),
    ),
  }));

  const emotionMix =
    scope === "overall"
      ? insights.emotion_patterns.overall_emotion_mix
      : insights.emotion_patterns.participant_emotion_mix.find(
          (participant) => participant.participant_id === scope,
        )?.breakdown ?? [];
  const archetypeMix =
    scope === "overall"
      ? insights.emotion_patterns.overall_archetype_mix
      : insights.emotion_patterns.participant_archetype_mix.find(
          (participant) => participant.participant_id === scope,
        )?.breakdown ?? [];

  const filteredRecords =
    scope === "overall"
      ? insights.detective_records
      : insights.detective_records.filter(
          (record) => record.winner_participant_id === null || record.winner_participant_id === scope,
        );
  const selectedSignalTotals =
    scope === "overall"
      ? insights.emotion_patterns.participant_signal_totals.reduce(
          (totals, participant) => ({
            support_count: totals.support_count + participant.support_count,
            conflict_count: totals.conflict_count + participant.conflict_count,
            repair_count: totals.repair_count + participant.repair_count,
          }),
          { support_count: 0, conflict_count: 0, repair_count: 0 },
        )
      : insights.emotion_patterns.participant_signal_totals.find(
          (participant) => participant.participant_id === scope,
        ) ?? { support_count: 0, conflict_count: 0, repair_count: 0 };
  const peakWindowPanels =
    scope === "overall"
      ? insights.time_patterns.participant_peak_windows
      : insights.time_patterns.participant_peak_windows.filter(
          (participant) => participant.participant_id === scope,
        );
  const monthWinnerPanels =
    scope === "overall"
      ? insights.time_patterns.month_winners.slice(-10)
      : insights.time_patterns.month_winners.filter(
          (month) => month.winner_participant_id === scope || month.winner_participant_id === null,
        );
  const chapterToneMatrix = decorateRepeatedTitles(insights.emotion_patterns.chapter_tone_matrix);
  const participantWithMostMessages = [...insights.participants].sort((left, right) => right.total_messages - left.total_messages)[0];
  const participantWithFastestReplies = [...insights.participants].sort(
    (left, right) => left.average_reply_gap_minutes - right.average_reply_gap_minutes,
  )[0];
  const participantWithMostEmoji = [...insights.participants].sort((left, right) => right.emoji_count - left.emoji_count)[0];
  const participantWithMostOpeners = [...insights.participants].sort(
    (left, right) => right.session_opener_count - left.session_opener_count,
  )[0];
  const peopleSpotlights = selectedParticipant
    ? [
        {
          label: "Message share",
          value: `${selectedParticipant.message_share.toFixed(1)}%`,
          detail: `${formatCompact(selectedParticipant.total_messages)} messages from ${selectedParticipant.label.split(" ")[0]}`,
        },
        {
          label: "Session openings",
          value: formatCompact(selectedParticipant.session_opener_count),
          detail: "Technical sessions opened first",
        },
        {
          label: "Weekend lean",
          value: `${selectedParticipant.weekend_percentage.toFixed(1)}%`,
          detail: "Share of their messages sent on weekends",
        },
        {
          label: "Longest note",
          value: `${formatCompact(selectedParticipant.longest_message_length)} chars`,
          detail: "Longest single message length",
        },
      ]
    : [
        {
          label: "Most messages",
          value: `${participantWithMostMessages.label} · ${formatCompact(participantWithMostMessages.total_messages)}`,
          detail: `${participantWithMostMessages.message_share.toFixed(1)}% of the full archive`,
        },
        {
          label: "Fastest replies",
          value: `${participantWithFastestReplies.label} · ${participantWithFastestReplies.average_reply_gap_minutes.toFixed(1)} min`,
          detail: "Average reply speed across the archive",
        },
        {
          label: "Most emojis",
          value: `${participantWithMostEmoji.label} · ${formatCompact(participantWithMostEmoji.emoji_count)}`,
          detail: "Total emoji count across sent messages",
        },
        {
          label: "Most openers",
          value: `${participantWithMostOpeners.label} · ${formatCompact(participantWithMostOpeners.session_opener_count)}`,
          detail: "Technical sessions started first",
        },
      ];

  return (
    <div className="section-stack">
      <Reveal>
        <section className="route-hero dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="hero-kicker">Dashboard</span>
            <h1>If you ever want the detective version of this archive.</h1>
            <p>
              {primaryReader && primaryReader.toLowerCase() !== "you"
                ? `${primaryReader}, this is where the patterns show themselves: who started, who stayed up late, which months went loud, and how the feeling kept changing.`
                : "This is where the patterns show themselves: who started, who stayed up late, which months went loud, and how the feeling kept changing."}
            </p>
          </div>
          <div className="hero-stat-strip hero-stat-strip--tight">
            <article className="stat-chip">
              <span>Messages shared</span>
              <strong>{formatCompact(signatureMetrics.headline.total_messages)}</strong>
            </article>
            <article className="stat-chip">
              <span>Longest streak</span>
              <strong>{signatureMetrics.headline.longest_daily_streak} days</strong>
            </article>
            <article className="stat-chip">
              <span>Most active month</span>
              <strong>{formatMonthYear(signatureMetrics.headline.most_active_month.month_key)}</strong>
            </article>
            <article className="stat-chip">
              <span>Late-night share</span>
              <strong>{signatureMetrics.headline.late_night_percentage.toFixed(1)}%</strong>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <div className="dashboard-anchor-nav">
          {[
            ["people", "The Two of You"],
            ["time", "Time"],
            ["mood", "Mood"],
            ["pace", "Pace"],
            ["records", "Records"],
          ].map(([href, label]) => (
            <a key={href} href={`#${href}`} className="pill">
              {label}
            </a>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <section id="people" className="dashboard-section">
          <SectionHeading
            eyebrow="The two of you"
            title="How each person showed up"
            description="Flip between views whenever you want the board to lean toward one side."
            align="left"
          />
          <div className="chip-toggle">
            <button type="button" data-active={scope === "overall"} onClick={() => setScope("overall")}>
              Overall
            </button>
            {insights.participants.map((participant) => (
              <button
                key={participant.participant_id}
                type="button"
                data-active={scope === participant.participant_id}
                onClick={() => setScope(participant.participant_id)}
              >
                {participant.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Share split</span>
                <strong>Message share</strong>
              </div>
              <div className="dashboard-donut">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Pie
                      data={insights.participants}
                      dataKey="message_share"
                      nameKey="label"
                      innerRadius={74}
                      outerRadius={112}
                      paddingAngle={5}
                    >
                      {insights.participants.map((participant, index) => (
                        <Cell key={participant.participant_id} fill={PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="dashboard-donut-center">
                  <span>{selectedParticipant ? selectedParticipant.label.split(" ")[0] : "Together"}</span>
                  <strong>
                    {selectedParticipant
                      ? `${selectedParticipant.message_share.toFixed(1)}%`
                      : formatCompact(signatureMetrics.headline.total_messages)}
                  </strong>
                </div>
              </div>
              <div className="tag-row tag-row--left">
                {insights.participants.map((participant, index) => (
                  <span key={participant.participant_id} className="tag" style={{ color: PARTICIPANT_COLORS[index] }}>
                    {participant.label}
                  </span>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Comparison strip</span>
                <strong>Volume, emoji use, and late nights</strong>
              </div>
              <div className="comparison-list">
                {insights.participants.map((participant, index) => (
                  <div key={participant.participant_id} className="comparison-block">
                    <div className="comparison-head">
                      <strong>{participant.label}</strong>
                      <span>{participant.message_share.toFixed(1)}% share</span>
                    </div>
                    <div className="comparison-row">
                      <span>Messages</span>
                      <strong>{formatCompact(participant.total_messages)}</strong>
                    </div>
                    <div className="comparison-bar">
                      <span
                        style={{
                          width: `${participant.message_share}%`,
                          background: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="comparison-row">
                      <span>Emoji share</span>
                      <strong>{participant.emoji_share.toFixed(1)}%</strong>
                    </div>
                    <div className="comparison-row">
                      <span>Late-night share</span>
                      <strong>{participant.late_night_percentage.toFixed(1)}%</strong>
                    </div>
                    <div className="comparison-row">
                      <span>Reply gap</span>
                      <strong>{participant.average_reply_gap_minutes.toFixed(1)} min</strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>How each one texts</span>
                <strong>Style signatures</strong>
              </div>
              <div className="signature-card-grid">
                {scopeParticipants.map((participant) => (
                  <div key={participant.participant_id} className="signature-card">
                    <div className="comparison-head">
                      <strong>{participant.label.split(" ")[0]}</strong>
                      <span>{participant.session_opener_share.toFixed(1)}% session-open share</span>
                    </div>
                    <div className="signature-stats">
                      <div className="signature-stat">
                        <span>Words / msg</span>
                        <strong>{participant.average_words_per_message.toFixed(1)}</strong>
                      </div>
                      <div className="signature-stat">
                        <span>Chars / msg</span>
                        <strong>{participant.average_chars_per_message.toFixed(1)}</strong>
                      </div>
                      <div className="signature-stat">
                        <span>Emoji / msg</span>
                        <strong>{participant.emoji_per_message.toFixed(2)}</strong>
                      </div>
                      <div className="signature-stat">
                        <span>Link share</span>
                        <strong>{participant.link_share.toFixed(1)}%</strong>
                      </div>
                      <div className="signature-stat">
                        <span>Multiline share</span>
                        <strong>{participant.multiline_share.toFixed(1)}%</strong>
                      </div>
                      <div className="signature-stat">
                        <span>Longest note</span>
                        <strong>{formatCompact(participant.longest_message_length)} chars</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Conversation openers</span>
                <strong>Who starts the rhythm more often</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={insights.participants}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Bar dataKey="session_opener_count" radius={[10, 10, 0, 0]}>
                      {insights.participants.map((participant, index) => (
                        <Cell key={participant.participant_id} fill={PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="dashboard-mini-metrics">
                {insights.participants.map((participant) => (
                  <div key={participant.participant_id} className="hero-metric hero-metric--compact">
                    <span>{participant.label.split(" ")[0]}</span>
                    <strong>{participant.weekend_percentage.toFixed(1)}%</strong>
                    <small>weekend share</small>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="dashboard-record-grid">
            {peopleSpotlights.map((spotlight, index) => (
              <article key={spotlight.label} className={`record-card ${index === 0 ? "record-card--feature" : ""}`}>
                <span>{spotlight.label}</span>
                <strong>{spotlight.value}</strong>
                <p>{spotlight.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="time" className="dashboard-section">
          <SectionHeading
            eyebrow="Time"
            title="When we were most alive"
            description="Months, weekdays, late nights, and the hours we kept meeting inside."
            align="left"
          />
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Monthly split</span>
                <strong>Volume by month</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlySeries}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month_key" minTickGap={26} tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    {selectedParticipant ? (
                      <Bar dataKey={selectedParticipant.participant_id} fill={PARTICIPANT_COLORS[0]} radius={[10, 10, 0, 0]} />
                    ) : (
                      insights.participants.map((participant, index) => (
                        <Bar
                          key={participant.participant_id}
                          dataKey={participant.participant_id}
                          stackId="messages"
                          fill={PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]}
                          radius={index === insights.participants.length - 1 ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Week rhythm</span>
                <strong>Day-of-week distribution</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weekdaySeries}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    {selectedParticipant ? (
                      <Bar dataKey={selectedParticipant.participant_id} fill={PARTICIPANT_COLORS[0]} radius={[10, 10, 0, 0]} />
                    ) : (
                      insights.participants.map((participant, index) => (
                        <Bar
                          key={participant.participant_id}
                          dataKey={participant.participant_id}
                          stackId="weekday"
                          fill={PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]}
                          radius={index === insights.participants.length - 1 ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Hour map</span>
                <strong>What time the archive wakes up</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={hourSeries}>
                    <defs>
                      <linearGradient id="dashboardHourGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#d88da5" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#d88da5" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" minTickGap={30} tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Area
                      type="monotone"
                      dataKey={selectedParticipant ? selectedParticipant.participant_id : "total_messages"}
                      stroke="#d88da5"
                      strokeWidth={2}
                      fill="url(#dashboardHourGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Late-night drift</span>
                <strong>Night messages by month</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lateNightSeries}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month_key" minTickGap={24} tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Line type="monotone" dataKey={selectedParticipant ? selectedParticipant.participant_id : "share"} stroke="#d88da5" strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Month winners</span>
                <strong>{selectedParticipant ? "Where this side led the month" : "Who edged which months"}</strong>
              </div>
              <div className="month-winner-grid">
                {monthWinnerPanels.map((month) => (
                  <div
                    key={month.month_key}
                    className={`winner-pill ${month.winner_participant_id ? "winner-pill--claimed" : "winner-pill--tie"}`}
                  >
                    <span>{formatMonthYear(month.month_key)}</span>
                    <strong>{month.winner_label ?? "Split"}</strong>
                    <small>{formatCompact(month.total_messages)} msgs</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Favorite windows</span>
                <strong>{selectedParticipant ? "Where this side usually appears" : "Each person's recurring windows"}</strong>
              </div>
              <div className="peak-window-grid">
                {peakWindowPanels.map((participant) => (
                  <div key={participant.participant_id} className="peak-window-card">
                    <div className="comparison-head">
                      <strong>{participant.label.split(" ")[0]}</strong>
                      <span>{participant.top_windows[0]?.label ?? "No peak yet"}</span>
                    </div>
                    <div className="window-list window-list--compact">
                      {participant.top_hours.slice(0, 2).map((hour) => (
                        <div key={`${participant.participant_id}-${hour.label}`} className="window-pill">
                          <span>{hour.label}</span>
                          <strong>{formatCompact(hour.count)}</strong>
                        </div>
                      ))}
                      {participant.top_weekdays.slice(0, 2).map((day) => (
                        <div key={`${participant.participant_id}-${day.label}`} className="window-pill window-pill--quiet">
                          <span>{day.label}</span>
                          <strong>{formatCompact(day.count)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Busiest windows</span>
                <strong>Where the archive keeps clustering</strong>
              </div>
              <div className="window-list">
                {insights.time_patterns.busiest_windows.map((window) => (
                  <div key={`${window.weekday}-${window.hour_of_day}`} className="window-pill">
                    <span>{window.label}</span>
                    <strong>{formatCompact(window.count)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Quietest windows</span>
                <strong>The softer hours that stayed quieter</strong>
              </div>
              <div className="window-list">
                {insights.time_patterns.quietest_windows.map((window) => (
                  <div key={`${window.weekday}-${window.hour_of_day}`} className="window-pill window-pill--quiet">
                    <span>{window.label}</span>
                    <strong>{formatCompact(window.count)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="mood" className="dashboard-section">
          <SectionHeading
            eyebrow="Mood"
            title="What the archive kept feeling like"
            description="Less transcript, more emotional shape."
            align="left"
          />
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Emotion mix</span>
                <strong>{selectedParticipant ? `${selectedParticipant.label}'s tone` : "Overall tone mix"}</strong>
              </div>
              <div className="dashboard-donut dashboard-donut--small">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Pie data={emotionMix} dataKey="count" nameKey="label" innerRadius={64} outerRadius={108}>
                      {emotionMix.map((entry, index) => (
                        <Cell key={entry.label} fill={MIX_COLORS[index % MIX_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="tag-row tag-row--left">
                {emotionMix.slice(0, 5).map((entry, index) => (
                  <span key={entry.label} className="tag" style={{ color: MIX_COLORS[index % MIX_COLORS.length] }}>
                    {entry.label}
                  </span>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Archetype mix</span>
                <strong>{selectedParticipant ? `${selectedParticipant.label}'s modes` : "Recurring conversation modes"}</strong>
                
              </div>
              <div className="dashboard-donut dashboard-donut--small">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Pie data={archetypeMix} dataKey="count" nameKey="label" innerRadius={64} outerRadius={108}>
                      {archetypeMix.map((entry, index) => (
                        <Cell key={entry.label} fill={MIX_COLORS[index % MIX_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="tag-row tag-row--left">
                {archetypeMix.slice(0, 5).map((entry, index) => (
                  <span key={entry.label} className="tag" style={{ color: MIX_COLORS[index % MIX_COLORS.length] }}>
                    {humanizeArchetypeLabel(entry.label)}
                  </span>
                ))}
              </div>
            </article>
          </div>
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Signal line</span>
                <strong>Support, conflict, and repair over time</strong>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={insights.emotion_patterns.signal_trend}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month_key" minTickGap={24} tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Line type="monotone" dataKey="support_count" stroke="#d88da5" strokeWidth={2.4} dot={false} />
                    <Line type="monotone" dataKey="conflict_count" stroke="#9f8790" strokeWidth={2.2} dot={false} />
                    <Line type="monotone" dataKey="repair_count" stroke="#efb6c4" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Chapter matrix</span>
                <strong>How the major phases read</strong>
              </div>
              <div className="tone-ribbon-grid">
                {chapterToneMatrix.map((chapter) => (
                  <Link key={chapter.chapter_id} href={`/chapters/${chapter.slug}` as Route} className="tone-chip" prefetch={false}>
                    <span>{chapter.display_title}</span>
                    <strong>{chapter.dominant_emotion}</strong>
                    <small>{humanizeArchetypeLabel(chapter.dominant_archetype)}</small>
                  </Link>
                ))}
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--single">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Signal totals</span>
                <strong>{selectedParticipant ? `${selectedParticipant.label.split(" ")[0]}'s signal mix` : "Support, conflict, and repair counts"}</strong>
              </div>
              <div className="signal-total-grid">
                <div className="signal-total-card signal-total-card--support">
                  <span>Support</span>
                  <strong>{formatCompact(selectedSignalTotals.support_count)}</strong>
                </div>
                <div className="signal-total-card signal-total-card--conflict">
                  <span>Conflict</span>
                  <strong>{formatCompact(selectedSignalTotals.conflict_count)}</strong>
                </div>
                <div className="signal-total-card signal-total-card--repair">
                  <span>Repair</span>
                  <strong>{formatCompact(selectedSignalTotals.repair_count)}</strong>
                </div>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="pace" className="dashboard-section">
          <SectionHeading
            eyebrow="Pace"
            title="How fast the conversation kept moving"
            description="Streaks, bursts, reply speed, and the pauses between them."
            align="left"
          />
          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Rhythm stats</span>
                <strong>Reply speed and sustained motion</strong>
              </div>
              <div className="dashboard-mini-metrics">
                <div className="hero-metric">
                  <span>Longest streak</span>
                  <strong>{signatureMetrics.headline.longest_daily_streak}</strong>
                </div>
                <div className="hero-metric">
                  <span>Longest session</span>
                  <strong>{formatCompact(signatureMetrics.headline.longest_technical_session.message_count)}</strong>
                </div>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={insights.participants}>
                    <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Bar dataKey="average_reply_gap_minutes" radius={[10, 10, 0, 0]}>
                      {insights.participants.map((participant, index) => (
                        <Cell key={participant.participant_id} fill={PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Session records</span>
                <strong>Longest and fastest stretches</strong>
              </div>
              <div className="session-stack">
                {insights.session_patterns.longest_sessions.slice(0, 3).map((session) => (
                  <div key={session.technical_session_id} className="session-card">
                    <div className="comparison-row">
                      <span>{formatIsoDate(session.start_timestamp)}</span>
                      <strong>{formatCompact(session.message_count)}</strong>
                    </div>
                    <div className="comparison-row">
                      <span>Density</span>
                      <strong>{session.density_score.toFixed(1)} msgs/hr</strong>
                    </div>
                  </div>
                ))}
                {insights.session_patterns.fastest_exchange_windows.slice(0, 2).map((session) => (
                  <div key={session.technical_session_id} className="session-card session-card--soft">
                    <div className="comparison-row">
                      <span>Fastest exchange</span>
                      <strong>{session.average_reply_gap_minutes.toFixed(1)} min</strong>
                    </div>
                    <div className="comparison-row">
                      <span>Window size</span>
                      <strong>{formatCompact(session.message_count)} msgs</strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid--two">
            <article className="panel-card">
              <div className="panel-topline">
                <span>Volume records</span>
                <strong>The loudest single days</strong>
              </div>
              <div className="window-list">
                {insights.session_patterns.highest_volume_days.map((day) => (
                  <div key={day.day_key} className="window-pill">
                    <span>{formatIsoDate(day.day_key)}</span>
                    <strong>{formatCompact(day.count)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel-card">
              <div className="panel-topline">
                <span>Silence gaps</span>
                <strong>Where the archive went noticeably quiet</strong>
              </div>
              <div className="session-stack">
                {insights.session_patterns.longest_silence_gaps.slice(0, 4).map((gap) => (
                  <div key={`${gap.from_message_id}-${gap.to_message_id}`} className="session-card session-card--quiet">
                    <div className="comparison-row">
                      <span>{formatIsoDate(gap.start_timestamp)}</span>
                      <strong>{gap.gap_minutes.toFixed(0)} min</strong>
                    </div>
                    <div className="comparison-row">
                      <span>
                        {gap.from_sender_label ?? "Unknown"} {"->"} {gap.to_sender_label ?? "Unknown"}
                      </span>
                      <strong>{Math.max(1, Math.round(gap.gap_minutes / 60))} hr</strong>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="records" className="dashboard-section">
          <SectionHeading
            eyebrow="Records"
            title="The facts that stand out most"
            description="Short visual headlines you can open from here."
            align="left"
          />
          <div className="dashboard-record-grid dashboard-record-grid--full">
            {filteredRecords.map((record, index) => {
              const Icon =
                index % 5 === 0
                  ? Users
                  : index % 5 === 1
                    ? TrendingUp
                    : index % 5 === 2
                      ? MoonStar
                      : index % 5 === 3
                        ? HeartHandshake
                        : TimerReset;

              return (
                <Link key={record.record_id} href={formatRecordRoute(record.route)} className="record-card" prefetch={false}>
                  <div className="record-card-topline">
                    <Icon size={18} />
                    <span>{record.label}</span>
                  </div>
                  <strong>{record.value}</strong>
                  <p>{record.detail}</p>
                  <span className="record-card-link">
                    Open route <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="quiet-band">
          <p>
            If this page starts feeling too analytical, step back into the story, the timeline, or the lighter memory pages.
          </p>
          <div className="pill-row">
            <Link href={"/" as Route} className="pill" prefetch={false}>
              Back to story
            </Link>
            <Link href={"/timeline/" as Route} className="pill" prefetch={false}>
              Open timeline
            </Link>
            <Link href={"/moments/" as Route} className="pill" prefetch={false}>
              Browse moments
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
