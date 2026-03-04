"use client";

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
  ReferenceArea,
  Legend,
} from "recharts";
import { formatDateDdMmYyyy } from "@/lib/date-utils";

type ForecastDay = {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
};

type ForecastDayFact = {
  date: string;
  balance: number | null;
  inflows: number | null;
  outflows: number | null;
  hasFactData: boolean;
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
  cumulativeInflows: number;
  cumulativeOutflows: number;
  balanceExpected?: number;
  profitExpected?: number;
  cumulativeInflowsExpected?: number;
  cumulativeOutflowsExpected?: number;
  balanceFact?: number | null;
  profitFact?: number | null;
  cumulativeInflowsFact?: number | null;
  cumulativeOutflowsFact?: number | null;
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
  dataExpected,
  dataFact,
  currency,
  section,
}: {
  dataExpected: ForecastDay[];
  dataFact?: ForecastDayFact[];
  currency: string;
  section?: string;
}) {
  const factByDate = dataFact
    ? new Map(dataFact.map((d) => [d.date, d]))
    : null;

  let lastCumInFact = 0;
  let lastCumOutFact = 0;
  let runningBalance: number | null = null;
  const baseChartData: ChartPoint[] = dataExpected.reduce<ChartPoint[]>((acc, d) => {
    const profit = Math.round(d.inflows - d.outflows);
    const balance = Math.round(d.balance);
    const inflows = Math.round(d.inflows);
    const outflows = Math.round(d.outflows);
    const prev = acc[acc.length - 1];
    const cumulativeInflows = (prev?.cumulativeInflows ?? 0) + inflows;
    const cumulativeOutflows = (prev?.cumulativeOutflows ?? 0) + outflows;
    const point: ChartPoint = {
      ...d,
      dateShort: formatDateDdMmYyyy(d.date),
      profit,
      profitPositive: profit >= 0 ? profit : 0,
      profitNegative: profit < 0 ? profit : 0,
      balance,
      positiveBalance: balance >= 0 ? balance : 0,
      negativeBalance: balance < 0 ? balance : 0,
      inflows,
      outflows,
      cumulativeInflows,
      cumulativeOutflows,
      balanceExpected: Math.round(d.balance),
      profitExpected: Math.round(d.inflows - d.outflows),
      cumulativeInflowsExpected: cumulativeInflows,
      cumulativeOutflowsExpected: cumulativeOutflows,
    };
    const fact = factByDate?.get(d.date);
    const mergedInflows = fact?.hasFactData && fact.inflows != null ? fact.inflows : d.inflows;
    const mergedOutflows = fact?.hasFactData && fact.outflows != null ? fact.outflows : d.outflows;
    if (fact?.hasFactData) {
      const profitFactVal = Math.round(mergedInflows - mergedOutflows);
      point.profitFact = profitFactVal;
      lastCumInFact += mergedInflows;
      lastCumOutFact += mergedOutflows;
      point.cumulativeInflowsFact = lastCumInFact;
      point.cumulativeOutflowsFact = lastCumOutFact;
      const balanceAtStartOfDay = runningBalance ?? (d.balance - d.inflows + d.outflows);
      runningBalance = balanceAtStartOfDay + mergedInflows - mergedOutflows;
      point.balanceFact = Math.round(runningBalance);
    } else {
      point.cumulativeInflowsFact = null;
      point.cumulativeOutflowsFact = null;
      const balanceAtStartOfDay = runningBalance ?? (d.balance - d.inflows + d.outflows);
      runningBalance = balanceAtStartOfDay + d.inflows - d.outflows;
    }
    acc.push(point);
    return acc;
  }, []);

  const chartDataWithProfitCrossings = insertZeroCrossings(
    baseChartData,
    (p) => p.profit,
    (p) => ({ ...p, profit: 0, profitPositive: 0, profitNegative: 0, profitFact: null })
  );

  const chartDataWithBalanceCrossings = insertZeroCrossings(
    baseChartData,
    (p) => p.balance,
    (p) => ({ ...p, balance: 0, positiveBalance: 0, negativeBalance: 0, balanceFact: null })
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

  const factByDateForTotals = dataFact ? new Map(dataFact.map((d) => [d.date, d])) : null;
  const totalIncome = chartData.reduce((s, d) => {
    const fact = factByDateForTotals?.get(d.date);
    const inflows = fact?.hasFactData && fact.inflows != null ? fact.inflows : d.inflows;
    return s + inflows;
  }, 0);
  const totalExpense = chartData.reduce((s, d) => {
    const fact = factByDateForTotals?.get(d.date);
    const outflows = fact?.hasFactData && fact.outflows != null ? fact.outflows : d.outflows;
    return s + outflows;
  }, 0);
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
                  const p = payload[0]?.payload as ChartPoint;
                  const balanceFact = p?.balanceFact;
                  const balanceExp = p?.balanceExpected ?? 0;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p className="text-muted-foreground">
                        Ожидаемый: {formatValue(balanceExp)}
                      </p>
                      {dataFact && (
                        <p style={{ color: (balanceFact ?? 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                          Факт: {balanceFact != null ? formatValue(balanceFact) : "—"}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {negativePeriods.map((p, i) => (
                <ReferenceArea key={i} x1={p.start} x2={p.end} fill="var(--danger)" fillOpacity={0.08} />
              ))}
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="balanceExpected" name="Ожидаемый" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              {dataFact && (
                <Line type="monotone" dataKey="balanceFact" name="Факт" stroke="var(--success)" strokeWidth={2} dot={false} connectNulls={false} />
              )}
              <Area type="monotone" dataKey="positiveBalance" name="" stroke="none" fill="var(--success)" fillOpacity={0.15} baseValue={0} legendType="none" />
              <Area type="monotone" dataKey="negativeBalance" stroke="none" fill="var(--danger)" fillOpacity={0.15} baseValue={0} legendType="none" />
              <Legend formatter={(value) => value ? <span style={{ color: "var(--foreground)" }}>{value}</span> : null} />
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
                  const p = payload[0]?.payload as ChartPoint;
                  const profitFact = p?.profitFact;
                  const profitExp = p?.profitExpected ?? 0;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p className="text-muted-foreground">
                        Ожидаемый: {formatValue(profitExp)}
                      </p>
                      {dataFact && (
                        <p style={{ color: (profitFact ?? 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                          Факт: {profitFact != null ? formatValue(profitFact) : "—"}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="profitExpected" name="Ожидаемый" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              {dataFact && (
                <Line type="monotone" dataKey="profitFact" name="Факт" stroke="var(--success)" strokeWidth={2} dot={false} connectNulls={false} />
              )}
              <Area type="monotone" dataKey="profitPositive" name="" stroke="none" fill="var(--success)" fillOpacity={0.2} baseValue={0} legendType="none" />
              <Area type="monotone" dataKey="profitNegative" stroke="none" fill="var(--danger)" fillOpacity={0.2} baseValue={0} legendType="none" />
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
                  const p = payload[0]?.payload as ChartPoint;
                  const cumInExp = p?.cumulativeInflowsExpected ?? 0;
                  const cumInFact = p?.cumulativeInflowsFact;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p className="text-muted-foreground">
                        Ожидаемый: {formatValue(cumInExp)}
                      </p>
                      {dataFact && (
                        <p style={{ color: "var(--success)" }}>
                          Факт: {cumInFact != null ? formatValue(cumInFact) : "—"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">За день: {formatValue(p?.inflows ?? 0)}</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="cumulativeInflowsExpected" name="Ожидаемый" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              {dataFact && (
                <Line type="monotone" dataKey="cumulativeInflowsFact" name="Факт" stroke="var(--success)" strokeWidth={2} dot={false} connectNulls={false} />
              )}
              <Area
                type="monotone"
                dataKey="cumulativeInflows"
                name=""
                stroke="var(--success)"
                fill="var(--success)"
                fillOpacity={0.15}
                strokeWidth={0}
                legendType="none"
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
                  const p = payload[0]?.payload as ChartPoint;
                  const cumOutExp = p?.cumulativeOutflowsExpected ?? 0;
                  const cumOutFact = p?.cumulativeOutflowsFact;
                  return (
                    <div style={tooltipStyle} className="px-3 py-2">
                      <p className="font-medium">Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}</p>
                      <p className="text-muted-foreground">
                        Ожидаемый: {formatValue(cumOutExp)}
                      </p>
                      {dataFact && (
                        <p style={{ color: "var(--danger)" }}>
                          Факт: {cumOutFact != null ? formatValue(cumOutFact) : "—"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">За день: {formatValue(p?.outflows ?? 0)}</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="cumulativeOutflowsExpected" name="Ожидаемый" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              {dataFact && (
                <Line type="monotone" dataKey="cumulativeOutflowsFact" name="Факт" stroke="var(--danger)" strokeWidth={2} dot={false} connectNulls={false} />
              )}
              <Area
                type="monotone"
                dataKey="cumulativeOutflows"
                name=""
                stroke="var(--danger)"
                fill="var(--danger)"
                fillOpacity={0.15}
                strokeWidth={0}
                legendType="none"
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
