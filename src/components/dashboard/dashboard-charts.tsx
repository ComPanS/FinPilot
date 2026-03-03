"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { formatDateDdMmYyyy } from "@/lib/date-utils";

type ForecastDay = {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
};

type ChartPoint = ForecastDay & {
  dateShort: string;
  profit: number;
  profitPositive: number;
  profitNegative: number;
  balance: number;
  positiveBalance: number;
  negativeBalance: number;
  inflows: number;
  outflows: number;
};

function insertZeroCrossings<T extends ChartPoint>(
  data: T[],
  getValue: (p: T) => number,
  setZero: (p: T) => T
): T[] {
  const result: T[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i]);
    const a = data[i];
    const b = data[i + 1];
    const va = getValue(a);
    const vb = b ? getValue(b) : undefined;
    if (vb !== undefined && va > 0 && vb < 0) {
      const t = va / (va - vb);
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      const midDate = new Date(dA + t * (dB - dA));
      const midDateStr = midDate.toISOString().slice(0, 10);
      result.push(setZero({ ...a, date: midDateStr, dateShort: formatDateDdMmYyyy(midDateStr) } as T));
    } else if (vb !== undefined && va < 0 && vb > 0) {
      const t = va / (va - vb);
      const dA = new Date(a.date).getTime();
      const dB = new Date(b.date).getTime();
      const midDate = new Date(dA + t * (dB - dA));
      const midDateStr = midDate.toISOString().slice(0, 10);
      result.push(setZero({ ...a, date: midDateStr, dateShort: formatDateDdMmYyyy(midDateStr) } as T));
    }
  }
  return result;
}

export function DashboardCharts({
  data,
  currency,
  section,
}: {
  data: ForecastDay[];
  currency: string;
  section?: string;
}) {
  const baseChartData: ChartPoint[] = data.map((d) => {
    const profit = Math.round(d.inflows - d.outflows);
    const balance = Math.round(d.balance);
    return {
      ...d,
      dateShort: formatDateDdMmYyyy(d.date),
      profit,
      profitPositive: profit >= 0 ? profit : 0,
      profitNegative: profit < 0 ? profit : 0,
      balance,
      positiveBalance: balance >= 0 ? balance : 0,
      negativeBalance: balance < 0 ? balance : 0,
      inflows: Math.round(d.inflows),
      outflows: Math.round(d.outflows),
    };
  });

  const chartDataWithProfitCrossings = insertZeroCrossings(
    baseChartData,
    (p) => p.profit,
    (p) => ({ ...p, profit: 0, profitPositive: 0, profitNegative: 0 })
  );

  const chartDataWithBalanceCrossings = insertZeroCrossings(
    baseChartData,
    (p) => p.balance,
    (p) => ({ ...p, balance: 0, positiveBalance: 0, negativeBalance: 0 })
  );

  const chartData = baseChartData;

  const tooltipStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  const formatValue = (v: number) =>
    Math.round(v).toLocaleString("ru") + " " + currency;

  const totalIncome = chartData.reduce((s, d) => s + d.inflows, 0);
  const totalExpense = chartData.reduce((s, d) => s + d.outflows, 0);
  const totalProfit = totalIncome - totalExpense;

  // Период восстановления: дни с отрицательным балансом (расход ещё надо покрывать)
  const negativeBalanceDays = chartData.filter((d) => d.balance < 0);
  const negativePeriods: { start: string; end: string }[] = [];
  let inNegative = false;
  let startKey = "";
  for (let i = 0; i < chartData.length; i++) {
    const d = chartData[i];
    if (d.balance < 0) {
      if (!inNegative) {
        inNegative = true;
        startKey = d.dateShort;
      }
    } else if (inNegative) {
      negativePeriods.push({ start: startKey, end: chartData[i - 1]?.dateShort ?? startKey });
      inNegative = false;
    }
  }
  if (inNegative) {
    negativePeriods.push({ start: startKey, end: chartData[chartData.length - 1]?.dateShort ?? startKey });
  }

  return (
    <div className="space-y-6">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Суммарная прибыль</h3>
          <p className={`mt-2 text-2xl font-bold ${totalProfit >= 0 ? "text-success" : "text-danger"}`}>{formatValue(totalProfit)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Суммарный доход</h3>
          <p className="mt-2 text-2xl font-bold text-success">{formatValue(totalIncome)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Суммарный расход</h3>
          <p className="mt-2 text-2xl font-bold text-danger">{formatValue(totalExpense)}</p>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-6">
      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Прибыль за месяц</h3>
        {negativeBalanceDays.length > 0 && (
          <p className="mb-2 text-xs text-danger">
            Период восстановления: {negativeBalanceDays.length} дн. с отрицательным балансом
            <span className="text-muted-foreground">
              {" "}(с {negativeBalanceDays[0]?.dateShort} по {negativeBalanceDays[negativeBalanceDays.length - 1]?.dateShort})
            </span>
          </p>
        )}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartDataWithBalanceCrossings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dateShort" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  const balance = p?.balance ?? 0;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p style={{ color: balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                        Прибыль за месяц: {formatValue(balance)}
                      </p>
                    </div>
                  );
                }}
              />
              {negativePeriods.map((p, i) => (
                <ReferenceArea key={i} x1={p.start} x2={p.end} fill="var(--danger)" fillOpacity={0.08} />
              ))}
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="positiveBalance" stroke="var(--success)" fill="var(--success)" fillOpacity={0.2} strokeWidth={2} baseValue={0} />
              <Area type="monotone" dataKey="negativeBalance" stroke="var(--danger)" fill="var(--danger)" fillOpacity={0.2} strokeWidth={2} baseValue={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Прибыль за день</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartDataWithProfitCrossings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dateShort" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  const profit = (p?.inflows ?? 0) - (p?.outflows ?? 0);
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p style={{ color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                        Прибыль за день: {formatValue(profit)}
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="profitPositive" stroke="var(--success)" fill="var(--success)" fillOpacity={0.25} strokeWidth={2} baseValue={0} />
              <Area type="monotone" dataKey="profitNegative" stroke="var(--danger)" fill="var(--danger)" fillOpacity={0.25} strokeWidth={2} baseValue={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Доход</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dateShort" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p style={{ color: "var(--success)" }}>
                        Доход: {formatValue(p?.inflows ?? 0)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="inflows"
                stroke="var(--success)"
                fill="var(--success)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Расход</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dateShort" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p style={{ color: "var(--danger)" }}>
                        Расход: {formatValue(p?.outflows ?? 0)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="outflows"
                stroke="var(--danger)"
                fill="var(--danger)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
    </div>
  );
}
