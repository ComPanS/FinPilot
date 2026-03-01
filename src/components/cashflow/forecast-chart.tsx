"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { getZone } from "@/lib/services/forecast";
import type { ForecastDay } from "@/types";

export function ForecastChart({ data }: { data: ForecastDay[] }) {
  const chartData = data.map((d) => ({
    ...d,
    balance: Math.round(d.balance),
    dateShort: d.date.slice(5),
  }));

  return (
    <div className="h-80 w-full rounded-lg border border-border bg-surface p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="dateShort" stroke="var(--muted)" fontSize={12} />
          <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(v) => v.toLocaleString()} />
          <Tooltip
            formatter={(value) => [String(value ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, " "), "Баланс"]}
            labelFormatter={(label) => `Дата: ${label}`}
          />
          <ReferenceLine y={50000} stroke="var(--success)" strokeDasharray="3 3" />
          <ReferenceLine y={-50000} stroke="var(--danger)" strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--primary)"
            fill="none"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-sm">
        <span className="text-success">≥ 50 000 — зелёная зона</span>
        <span className="text-warning">-50 000 … +50 000 — жёлтая</span>
        <span className="text-danger">&lt; -50 000 — красная зона</span>
      </div>
    </div>
  );
}
