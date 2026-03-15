"use client";

import { useResponsiveChartHeight } from "@/components/use-responsive-chart-height";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { EmotionTimelinePoint } from "../../pipeline/schemas.js";

type EmotionArcChartProps = {
  points: EmotionTimelinePoint[];
};

export function EmotionArcChart({ points }: EmotionArcChartProps) {
  const chartHeight = useResponsiveChartHeight();

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <AreaChart data={points}>
          <defs>
            <linearGradient id="emotionGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#d88da5" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#d88da5" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period_label"
            minTickGap={48}
            tick={{ fill: "#7a6960", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: "#7a6960", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "18px",
              border: "1px solid rgba(122,105,96,0.14)",
              background: "rgba(255,250,247,0.96)",
            }}
          />
          <Area
            type="monotone"
            dataKey="average_intensity"
            stroke="#d88da5"
            strokeWidth={2}
            fill="url(#emotionGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
