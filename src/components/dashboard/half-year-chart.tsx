"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  getHalfYearChartDataAction,
  type HalfYearChartPoint,
} from "@/app/actions/forecast";

type ChartPoint = HalfYearChartPoint & {
  profitPositive: number;
  profitNegative: number;
  profitFact: number | null;
  profitExpected: number | null;
};

export function HalfYearChart({
  profileId,
  currency,
}: {
  profileId: string;
  currency: string;
}) {
  const [data, setData] = useState<ChartPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHalfYearChartDataAction(profileId).then((res) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      const raw = res.data ?? [];
      const chartData: ChartPoint[] = raw.map((d) => ({
        ...d,
        profitPositive: d.profit >= 0 ? d.profit : 0,
        profitNegative: d.profit < 0 ? d.profit : 0,
        profitFact: d.type === "fact" ? d.profit : null,
        profitExpected: d.type === "expected" ? d.profit : null,
      }));
      const lastFactIdx = chartData.findLastIndex((d) => d.type === "fact");
      const firstExpectedIdx = chartData.findIndex((d) => d.type === "expected");
      if (lastFactIdx >= 0 && firstExpectedIdx >= 0 && lastFactIdx + 1 === firstExpectedIdx) {
        chartData[lastFactIdx].profitExpected = chartData[lastFactIdx].profit;
      }
      setData(chartData);
    });
  }, [profileId]);

  const formatValue = (v: number) =>
    Math.round(v).toLocaleString("ru") + " " + currency;

  const tooltipStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  if (loading) {
    return (
      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Факт и ожидаемые за 12 месяцев
        </h3>
        <div className="flex h-80 items-center justify-center text-muted-foreground">
          Загрузка...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Факт и ожидаемые за 12 месяцев
        </h3>
        <p className="text-sm text-muted-foreground">{error ?? "Нет данных"}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        Факт и ожидаемые за 12 месяцев
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Прошлые 6 месяцев — факт, следующие 6 месяцев — ожидаемые
      </p>
      {(() => {
        const negativeMonths = data.filter((d) => d.profit < 0);
        return negativeMonths.length > 0 ? (
          <p className="mb-4 text-xs text-danger">
            Возможны кассовые разрывы:{" "}
            {negativeMonths.map((d) => d.monthLabel).join(", ")}
          </p>
        ) : null;
      })()}
      <div className="h-80 min-h-[320px] min-w-0 w-full">
        <ResponsiveContainer
          width="100%"
          height={320}
          minWidth={200}
          minHeight={300}
        >
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="monthLabel"
              stroke="var(--muted)"
              fontSize={11}
              interval={0}
            />
            <YAxis
              stroke="var(--muted)"
              fontSize={11}
              tickFormatter={(v) => Math.round(v).toLocaleString("ru")}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as ChartPoint;
                const val = p?.profitFact ?? p?.profitExpected ?? 0;
                const label =
                  p?.type === "fact" ? "Прибыль" : "Ожидаемая прибыль";
                return (
                  <div style={tooltipStyle} className="px-3 py-2">
                    <p className="font-medium">{p?.monthLabel}</p>
                    <p
                      style={{
                        color: val >= 0 ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {label}: {formatValue(val)}
                    </p>
                  </div>
                );
              }}
              cursor={{
                stroke: "var(--muted)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="profitExpected"
              name="Ожидаемые"
              stroke="var(--muted)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="profitFact"
              name="Факт"
              stroke="var(--success)"
              strokeWidth={2}
              dot={{
                r: 4,
                fill: "var(--success)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
              connectNulls={false}
              activeDot={{
                r: 5,
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="profitPositive"
              name=""
              stroke="none"
              fill="var(--success)"
              fillOpacity={0.2}
              baseValue={0}
              legendType="none"
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="profitNegative"
              stroke="none"
              fill="var(--danger)"
              fillOpacity={0.2}
              baseValue={0}
              legendType="none"
              activeDot={false}
            />
            <Legend
              formatter={(value) =>
                value ? (
                  <span style={{ color: "var(--foreground)" }}>{value}</span>
                ) : null
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
