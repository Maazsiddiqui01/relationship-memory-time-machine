"use client";

type HeatmapGridProps = {
  bins: Array<{
    weekday: number;
    hour_of_day: number;
    count: number;
  }>;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HeatmapGrid({ bins }: HeatmapGridProps) {
  const max = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <div className="heatmap-shell" style={{ width: "100%", overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ minWidth: "min(540px, 100%)" }}>
        <div
          className="heatmap-labels"
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 12 }}
        >
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              style={{ color: "var(--ink-soft)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {weekday}
            </span>
          ))}
        </div>
        <div className="heatmap-grid" style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gap: 4 }}>
          {bins.map((bin) => {
            const strength = Math.max(0.1, bin.count / max);
            return (
              <div
                key={`${bin.weekday}-${bin.hour_of_day}`}
                className="heatmap-cell"
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 4,
                  background: `rgba(210, 140, 140, ${strength})`,
                }}
                title={`${WEEKDAYS[bin.weekday]} ${bin.hour_of_day}:00 - ${bin.count} messages`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
