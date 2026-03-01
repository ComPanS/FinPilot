"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import type { ForecastDay } from "@/types";

export function ForecastChart({
  data,
  zoneGreenMin = 50000,
  zoneRedMax = -50000,
}: {
  data: ForecastDay[];
  zoneGreenMin?: number;
  zoneRedMax?: number;
}) {
  const chartData = data.map((d) => {
    const balance = Math.round(d.balance);
    return {
      ...d,
      balance,
      dateShort: d.date.slice(5),
      positiveBalance: balance >= 0 ? balance : 0,
      negativeBalance: balance < 0 ? balance : 0,
    };
  });

  const tooltipContentStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload?: { balance?: number; date?: string; dateShort?: string } }[] }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const value = point?.balance ?? 0;
    const fullDate = point?.date ?? point?.dateShort ?? "";
    const isNegative = value < 0;
    return (
      <div style={tooltipContentStyle} className="px-3 py-2">
        <p className="font-medium" style={{ color: "var(--foreground)" }}>Дата: {fullDate}</p>
        <p style={{ color: isNegative ? "var(--danger)" : "var(--success)" }}>
          Баланс: {String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
        </p>
      </div>
    );
  };

  return (
    <div className="h-80 w-full rounded-lg border border-border bg-surface p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="dateShort" stroke="var(--foreground)" fontSize={12} />
          <YAxis stroke="var(--foreground)" fontSize={12} tickFormatter={(v) => v.toLocaleString()} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={zoneGreenMin} stroke="var(--success)" strokeDasharray="3 3" />
          <ReferenceLine y={zoneRedMax} stroke="var(--danger)" strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Area
            type="monotone"
            dataKey="positiveBalance"
            stroke="var(--success)"
            fill="var(--success)"
            fillOpacity={0.2}
            strokeWidth={2}
            baseValue={0}
          />
          <Area
            type="monotone"
            dataKey="negativeBalance"
            stroke="var(--danger)"
            fill="var(--danger)"
            fillOpacity={0.2}
            strokeWidth={2}
            baseValue={0}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-sm">
        <span className="text-success">≥ {zoneGreenMin.toLocaleString("ru")} — зелёная зона</span>
        <span className="text-warning">{zoneRedMax.toLocaleString("ru")} … {zoneGreenMin.toLocaleString("ru")} — жёлтая</span>
        <span className="text-danger">&lt; {zoneRedMax.toLocaleString("ru")} — красная зона</span>
      </div>
    </div>
  );
}
