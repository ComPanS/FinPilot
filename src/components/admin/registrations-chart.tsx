"use client";

import { useState, useEffect } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { getRegistrationsByDay } from "@/app/admin/actions";

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

type ChartData = { date: string; count: number }[];

export function RegistrationsChart({
  initialData,
}: {
  initialData?: ChartData;
}) {
  const [period, setPeriod] = useState<30 | 90 | 365>(30);
  const [fetchData, setFetchData] = useState<ChartData | null>(null);

  const data =
    period === 30 && initialData ? initialData : (fetchData ?? []);

  useEffect(() => {
    if (period === 30) return;
    getRegistrationsByDay(period).then(setFetchData);
  }, [period]);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">
          Регистрации по дням
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPeriod(30)}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              period === 30
                ? "bg-primary text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            30 дней
          </button>
          <button
            type="button"
            onClick={() => setPeriod(90)}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              period === 90
                ? "bg-primary text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            90 дней
          </button>
          <button
            type="button"
            onClick={() => setPeriod(365)}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              period === 365
                ? "bg-primary text-white"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            365 дней
          </button>
        </div>
      </div>
      <div className="h-80 min-h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              stroke="var(--muted)"
              fontSize={11}
              tickFormatter={formatDate}
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={11}
              tickFormatter={(v) => String(Math.round(v))}
              domain={([, dataMax]) => [10, Math.max(10, (dataMax ?? 0) + 2)]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as { date: string; count: number };
                return (
                  <div style={tooltipStyle} className="px-3 py-2">
                    <p className="font-medium">{formatDate(p?.date ?? "")}</p>
                    <p className="text-muted-foreground">
                      Регистраций: {p?.count ?? 0}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ fill: "var(--primary)", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
