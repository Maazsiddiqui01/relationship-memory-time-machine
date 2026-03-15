"use client";

import { useResponsiveChartHeight } from "@/components/use-responsive-chart-height";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MonthlyVolumePoint } from "@/lib/curation";

type MonthlyVolumeChartProps = {
  points: MonthlyVolumePoint[];
};

export function MonthlyVolumeChart({ points }: MonthlyVolumeChartProps) {
  const chartHeight = useResponsiveChartHeight();

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <BarChart data={points}>
          <CartesianGrid stroke="rgba(120, 101, 95, 0.14)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month_key"
            minTickGap={24}
            tick={{ fill: "#7a6960", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fill: "#7a6960", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(220, 175, 184, 0.18)" }}
            contentStyle={{
              borderRadius: "18px",
              border: "1px solid rgba(122,105,96,0.14)",
              background: "rgba(255,250,247,0.96)",
            }}
          />
          <Bar dataKey="count" fill="#d88da5" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
