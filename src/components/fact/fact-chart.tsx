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
import type { ForecastDayFact } from "@/types";
import { formatDateDdMmYyyy } from "@/lib/date-utils";

export function FactChart({
  data,
  zoneGreenMin = 50000,
  zoneRedMax = -50000,
  currency,
}: {
  data: ForecastDayFact[];
  zoneGreenMin?: number;
  zoneRedMax?: number;
  currency: string;
}) {
  const chartData = data
    .filter((d) => d.hasFactData && d.balance != null)
    .map((d) => {
      const balance = Math.round(d.balance!);
      return {
        ...d,
        balance,
        dateShort: formatDateDdMmYyyy(d.date),
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

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: {
      payload?: { balance?: number; date?: string; dateShort?: string; inflows?: number; outflows?: number };
    }[];
  }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    const value = point?.balance ?? 0;
    const fullDate = point?.date
      ? formatDateDdMmYyyy(point.date)
      : (point?.dateShort ?? "");
    const isNegative = value < 0;
    const inflows = point?.inflows ?? 0;
    const outflows = point?.outflows ?? 0;
    return (
      <div style={tooltipContentStyle} className="px-3 py-2">
        <p className="font-medium" style={{ color: "var(--foreground)" }}>
          Дата: {fullDate}
        </p>
        <p style={{ color: "var(--success)" }}>
          Поступления: {Math.round(inflows).toLocaleString("ru")} {currency}
        </p>
        <p style={{ color: "var(--danger)" }}>
          Расходы: {Math.round(outflows).toLocaleString("ru")} {currency}
        </p>
        <p style={{ color: isNegative ? "var(--danger)" : "var(--success)" }}>
          Баланс: {String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} {currency}
        </p>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 min-h-[320px] min-w-0 w-full items-center justify-center rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">
          Нет фактических данных для отображения. Введите фактические значения в регулярных расходах и доходах.
        </p>
      </div>
    );
  }

  return (
    <div className="h-80 min-h-[320px] min-w-0 w-full rounded-lg border border-border bg-surface p-4">
      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="dateShort" stroke="var(--foreground)" fontSize={12} />
          <YAxis
            stroke="var(--foreground)"
            fontSize={12}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <ReferenceLine
            y={zoneGreenMin}
            stroke="var(--success)"
            strokeDasharray="3 3"
          />
          <ReferenceLine
            y={zoneRedMax}
            stroke="var(--danger)"
            strokeDasharray="3 3"
          />
          <ReferenceLine y={0} stroke="var(--muted)" />
          <Area
            type="monotoneX"
            dataKey="positiveBalance"
            stroke="var(--success)"
            fill="var(--success)"
            fillOpacity={0.2}
            strokeWidth={2}
            baseValue={0}
            activeDot={false}
          />
          <Area
            type="monotoneX"
            dataKey="negativeBalance"
            stroke="var(--danger)"
            fill="var(--danger)"
            fillOpacity={0.2}
            strokeWidth={2}
            baseValue={0}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-success">
          ≥ {zoneGreenMin.toLocaleString("ru")} — зелёная зона
        </span>
        <span className="text-warning">
          {zoneRedMax.toLocaleString("ru")} …{" "}
          {zoneGreenMin.toLocaleString("ru")} — жёлтая
        </span>
        <span className="text-danger">
          &lt; {zoneRedMax.toLocaleString("ru")} — красная зона
        </span>
      </div>
    </div>
  );
}
