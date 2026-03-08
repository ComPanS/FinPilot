"use client";

import { useMemo } from "react";
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

export type VisibleCharts = {
  balance?: boolean;
  profit?: boolean;
  income?: boolean;
  expense?: boolean;
};

type ManualTx = { date: string; type: "IN" | "OUT"; amount: number; description?: string };

export function DashboardCharts({
  dataExpected,
  dataFact,
  currency,
  section: _section,
  showPatternHint,
  usedPatterns,
  hasEnoughPatternData,
  visibleCharts,
  manualTransactions = [],
}: {
  dataExpected: ForecastDay[];
  dataFact?: ForecastDayFact[];
  currency: string;
  section?: string;
  showPatternHint?: boolean;
  usedPatterns?: boolean;
  hasEnoughPatternData?: boolean;
  visibleCharts?: VisibleCharts;
  manualTransactions?: ManualTx[];
}) {
  const showBalance = visibleCharts?.balance ?? true;
  const showProfit = visibleCharts?.profit ?? true;
  const showIncome = visibleCharts?.income ?? true;
  const showExpense = visibleCharts?.expense ?? true;
  const baseChartData = useMemo(() => {
    const factByDate = dataFact
      ? new Map(dataFact.map((d) => [d.date, d]))
      : null;
    const hasFactData = factByDate != null && factByDate.size > 0;
    const initialBalance =
      dataExpected.length > 0
        ? dataExpected[0].balance -
          dataExpected[0].inflows +
          dataExpected[0].outflows
        : 0;

    type Acc = { points: ChartPoint[]; balance: number; cumInFact: number; cumOutFact: number };
    const initial: Acc = { points: [], balance: initialBalance, cumInFact: 0, cumOutFact: 0 };

    // Income chart: ONLY inflows (regular + one-time IN). Expense chart: ONLY outflows (regular + one-time OUT).
    // Never mix: inflows must never include outflows, outflows must never include inflows.
    const result = dataExpected.reduce<Acc>((acc, d) => {
      const inflows = Math.round(Math.max(0, d.inflows ?? 0));
      const outflows = Math.round(Math.max(0, d.outflows ?? 0));
      const profit = Math.round((d.inflows ?? 0) - (d.outflows ?? 0));
      const prev = acc.points[acc.points.length - 1];
      const cumulativeInflows = Math.round(
        Math.max(0, (prev?.cumulativeInflows ?? 0) + inflows),
      );
      const cumulativeOutflows = Math.round(
        Math.max(0, (prev?.cumulativeOutflows ?? 0) + outflows),
      );

      const fact = factByDate?.get(d.date);

      let balanceExpected: number;
      let profitExpected: number;
      let cumulativeInflowsExpected: number;
      let cumulativeOutflowsExpected: number;
      let nextCumInFact = acc.cumInFact;
      let nextCumOutFact = acc.cumOutFact;
      let nextBalance = acc.balance;

      if (hasFactData && fact?.hasFactData) {
        const inVal = fact.inflows ?? inflows;
        const outVal = fact.outflows ?? outflows;
        // Всегда накапливаем cumInFact/cumOutFact: факт если есть, иначе ожидаемое (избегаем просадки при первом дне с фактом)
        nextCumInFact = Math.round(
          acc.cumInFact + (fact.inflows != null ? Math.max(0, fact.inflows) : inflows),
        );
        nextCumOutFact = Math.round(
          acc.cumOutFact + (fact.outflows != null ? Math.max(0, fact.outflows) : outflows),
        );
        if (fact.balance != null) {
          nextBalance = Math.round(fact.balance);
        } else {
          nextBalance = acc.balance + inVal - outVal;
        }
        balanceExpected = Math.round(nextBalance);
        profitExpected = Math.round(inVal - outVal);
        cumulativeInflowsExpected = nextCumInFact;
        cumulativeOutflowsExpected = nextCumOutFact;
      } else {
        nextBalance = acc.balance + inflows - outflows;
        balanceExpected = Math.round(nextBalance);
        profitExpected = profit;
        // Дни без факта: накапливаем ожидаемые значения в cumInFact/cumOutFact
        nextCumInFact = Math.round(acc.cumInFact + inflows);
        nextCumOutFact = Math.round(acc.cumOutFact + outflows);
        cumulativeInflowsExpected = nextCumInFact;
        cumulativeOutflowsExpected = nextCumOutFact;
      }

      const balanceForArea = hasFactData
        ? balanceExpected
        : Math.round(d.balance);
      const positiveBalance = balanceForArea >= 0 ? balanceForArea : 0;
      const negativeBalance = balanceForArea < 0 ? balanceForArea : 0;
      const cumulativeInflowsForArea = Math.round(
        hasFactData ? cumulativeInflowsExpected : cumulativeInflows,
      );
      const cumulativeOutflowsForArea = Math.round(
        hasFactData ? cumulativeOutflowsExpected : cumulativeOutflows,
      );

      const point: ChartPoint = {
        ...d,
        dateShort: formatDateDdMmYyyy(d.date),
        profit,
        profitPositive: profit >= 0 ? profit : 0,
        profitNegative: profit < 0 ? profit : 0,
        balance: balanceForArea,
        positiveBalance,
        negativeBalance,
        inflows,
        outflows,
        cumulativeInflows: cumulativeInflowsForArea,
        cumulativeOutflows: cumulativeOutflowsForArea,
        balanceExpected,
        profitExpected,
        cumulativeInflowsExpected: Math.round(cumulativeInflowsExpected),
        cumulativeOutflowsExpected: Math.round(cumulativeOutflowsExpected),
      };

      if (fact?.hasFactData) {
        point.profitFact =
          fact.inflows != null && fact.outflows != null
            ? Math.round(fact.inflows - fact.outflows)
            : null;
        point.cumulativeInflowsFact =
          fact.inflows != null ? Math.round(nextCumInFact) : null;
        point.cumulativeOutflowsFact =
          fact.outflows != null ? Math.round(nextCumOutFact) : null;
        point.balanceFact =
          fact.balance != null ? Math.round(fact.balance) : null;
      } else {
        point.profitFact = null;
        point.cumulativeInflowsFact = null;
        point.cumulativeOutflowsFact = null;
        point.balanceFact = null;
      }

      return {
        points: [...acc.points, point],
        balance: nextBalance,
        cumInFact: nextCumInFact,
        cumOutFact: nextCumOutFact,
      };
    }, initial);

    return result.points;
  }, [dataExpected, dataFact]);

  const chartDataWithProfitCrossings = baseChartData;
  const chartDataWithBalanceCrossings = baseChartData;
  const chartData = baseChartData;

  const manualByDate = useMemo(() => {
    const m = new Map<string, ManualTx[]>();
    for (const t of manualTransactions) {
      const list = m.get(t.date) ?? [];
      list.push(t);
      m.set(t.date, list);
    }
    return m;
  }, [manualTransactions]);

  const tooltipStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  const formatValue = (v: number) =>
    Math.round(v).toLocaleString("ru") + " " + currency;

  const factByDateForTotals = dataFact
    ? new Map(dataFact.map((d) => [d.date, d]))
    : null;
  const totalIncome = chartData.reduce((s, d) => {
    const fact = factByDateForTotals?.get(d.date);
    const inflows =
      fact?.hasFactData && fact.inflows != null ? fact.inflows : d.inflows;
    return s + Math.max(0, inflows ?? 0);
  }, 0);
  const totalExpense = chartData.reduce((s, d) => {
    const fact = factByDateForTotals?.get(d.date);
    const outflows =
      fact?.hasFactData && fact.outflows != null ? fact.outflows : d.outflows;
    return s + Math.max(0, outflows ?? 0);
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
      negativePeriods.push({
        start: startKey,
        end: chartData[i - 1]?.dateShort ?? startKey,
      });
      inNegative = false;
    }
  }
  if (inNegative) {
    negativePeriods.push({
      start: startKey,
      end: chartData[chartData.length - 1]?.dateShort ?? startKey,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Суммарная прибыль
          </h3>
          <p
            className={`mt-2 text-2xl font-bold ${totalProfit >= 0 ? "text-success" : "text-danger"}`}
          >
            {formatValue(totalProfit)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Суммарный доход
          </h3>
          <p className="mt-2 text-2xl font-bold text-success">
            {formatValue(totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Суммарный расход
          </h3>
          <p className="mt-2 text-2xl font-bold text-danger">
            {formatValue(totalExpense)}
          </p>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-6">
        {showBalance && (
        <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Прибыль за месяц
          </h3>
          {negativeBalanceDays.length > 0 && (
            <p className="mb-2 text-xs text-danger">
              Период восстановления: {negativeBalanceDays.length} дн. с
              отрицательным балансом
              <span className="text-muted-foreground">
                {" "}
                (с {negativeBalanceDays[0]?.dateShort} по{" "}
                {negativeBalanceDays[negativeBalanceDays.length - 1]?.dateShort}
                )
              </span>
            </p>
          )}
          <div className="h-80 min-h-[320px] min-w-0 w-full">
            <ResponsiveContainer
              width="100%"
              height={320}
              minWidth={200}
              minHeight={300}
            >
              <AreaChart data={chartDataWithBalanceCrossings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="dateShort"
                  stroke="var(--muted)"
                  fontSize={11}
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
                    const balanceFact = p?.balanceFact;
                    const balanceExp = p?.balanceExpected ?? 0;
                    const val = balanceFact != null ? balanceFact : balanceExp;
                    const label = balanceFact != null ? "Баланс" : "Ожидаемый баланс";
                    const manualOnDate = (p?.date ? manualByDate.get(p.date) : []) ?? [];
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="font-medium">
                          Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                        </p>
                        <p
                          style={{
                            color:
                              val >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {label}: {formatValue(val)}
                        </p>
                        {manualOnDate.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {t.description || (t.type === "IN" ? "Разовый доход" : "Разовый расход")}: {formatValue(t.amount)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                  cursor={{
                    stroke: "var(--muted)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                />
                {negativePeriods.map((p, i) => (
                  <ReferenceArea
                    key={i}
                    x1={p.start}
                    x2={p.end}
                    fill="var(--danger)"
                    fillOpacity={0.08}
                  />
                ))}
                <ReferenceLine
                  y={0}
                  stroke="var(--muted)"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotoneX"
                  dataKey="balanceExpected"
                  name="Ожидаемый"
                  stroke="var(--muted)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                />
                {dataFact && (
                  <Line
                    type="monotoneX"
                    dataKey="balanceFact"
                    name="Факт"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--success)", stroke: "var(--surface)", strokeWidth: 2 }}
                    connectNulls={false}
                    activeDot={{
                      r: 5,
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                )}
                <Area
                  type="monotoneX"
                  dataKey="positiveBalance"
                  name=""
                  stroke="none"
                  fill="var(--success)"
                  fillOpacity={0.15}
                  baseValue={0}
                  legendType="none"
                  activeDot={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="negativeBalance"
                  stroke="none"
                  fill="var(--danger)"
                  fillOpacity={0.15}
                  baseValue={0}
                  legendType="none"
                  activeDot={false}
                />
                <Legend
                  formatter={(value) =>
                    value ? (
                      <span style={{ color: "var(--foreground)" }}>
                        {value}
                      </span>
                    ) : null
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {showProfit && (
        <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Прибыль за день
          </h3>
          <div className="h-80 min-h-[320px] min-w-0 w-full">
            <ResponsiveContainer
              width="100%"
              height={320}
              minWidth={200}
              minHeight={300}
            >
              <AreaChart data={chartDataWithProfitCrossings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="dateShort"
                  stroke="var(--muted)"
                  fontSize={11}
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
                    const profitFact = p?.profitFact;
                    const profitExp = p?.profitExpected ?? 0;
                    const val = profitFact != null ? profitFact : profitExp;
                    const label = profitFact != null ? "Прибыль" : "Ожидаемая прибыль";
                    const manualOnDate = (p?.date ? manualByDate.get(p.date) : []) ?? [];
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="font-medium">
                          Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                        </p>
                        <p
                          style={{
                            color:
                              val >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {label}: {formatValue(val)}
                        </p>
                        {manualOnDate.map((t, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {t.description || (t.type === "IN" ? "Разовый доход" : "Разовый расход")}: {formatValue(t.amount)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                  cursor={{
                    stroke: "var(--muted)",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--muted)"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotoneX"
                  dataKey="profitExpected"
                  name="Ожидаемый"
                  stroke="var(--muted)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                />
                {dataFact && (
                  <Line
                    type="monotoneX"
                    dataKey="profitFact"
                    name="Факт"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--success)", stroke: "var(--surface)", strokeWidth: 2 }}
                    connectNulls={false}
                    activeDot={{
                      r: 5,
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                )}
                <Area
                  type="monotoneX"
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
                  type="monotoneX"
                  dataKey="profitNegative"
                  stroke="none"
                  fill="var(--danger)"
                  fillOpacity={0.2}
                  baseValue={0}
                  legendType="none"
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          {showIncome && (
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Доход
            </h3>
            {/* Only inflows (regular + one-time incomes). No expenses. */}
            <div className="h-80 min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={200}
                minHeight={300}
              >
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="dateShort"
                    stroke="var(--muted)"
                    fontSize={11}
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
                      const cumInExp = p?.cumulativeInflowsExpected ?? 0;
                      const cumInFact = p?.cumulativeInflowsFact;
                      const val = cumInFact != null ? cumInFact : cumInExp;
                      const label = cumInFact != null ? "Доход" : "Ожидаемый доход";
                      const manualIn = (p?.date ? manualByDate.get(p.date) : [])?.filter((t) => t.type === "IN") ?? [];
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">
                            Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                          </p>
                          <p style={{ color: "var(--success)" }}>
                            {label}: {formatValue(val)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            За день: {formatValue(p?.inflows ?? 0)}
                          </p>
                          {manualIn.length > 0 &&
                            manualIn.map((t, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                {t.description || "Разовый доход"}: {formatValue(t.amount)}
                              </p>
                            ))}
                        </div>
                      );
                    }}
                    cursor={{
                      stroke: "var(--muted)",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                  />
                  <Line
                    type="monotoneX"
                    dataKey="cumulativeInflowsExpected"
                    name="Ожидаемый"
                    stroke="var(--muted)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                  {dataFact && (
                    <Line
                      type="monotoneX"
                      dataKey="cumulativeInflowsFact"
                      name="Факт"
                      stroke="var(--success)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--success)", stroke: "var(--surface)", strokeWidth: 2 }}
                      connectNulls={false}
                      activeDot={{
                        r: 5,
                        stroke: "var(--surface)",
                        strokeWidth: 2,
                      }}
                    />
                  )}
                  <Area
                    type="monotoneX"
                    dataKey="cumulativeInflows"
                    name=""
                    stroke="var(--success)"
                    fill="var(--success)"
                    fillOpacity={0.15}
                    strokeWidth={0}
                    legendType="none"
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {showExpense && (
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Расход
            </h3>
            {/* Only outflows (regular + one-time expenses). No incomes. */}
            <div className="h-80 min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={200}
                minHeight={300}
              >
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="dateShort"
                    stroke="var(--muted)"
                    fontSize={11}
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
                      const cumOutExp = p?.cumulativeOutflowsExpected ?? 0;
                      const cumOutFact = p?.cumulativeOutflowsFact;
                      const val = cumOutFact != null ? cumOutFact : cumOutExp;
                      const label = cumOutFact != null ? "Расход" : "Ожидаемый расход";
                      const manualOut = (p?.date ? manualByDate.get(p.date) : [])?.filter((t) => t.type === "OUT") ?? [];
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">
                            Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                          </p>
                          <p style={{ color: "var(--danger)" }}>
                            {label}: {formatValue(val)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            За день: {formatValue(p?.outflows ?? 0)}
                          </p>
                          {manualOut.length > 0 &&
                            manualOut.map((t, i) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                {t.description || "Разовый расход"}: {formatValue(t.amount)}
                              </p>
                            ))}
                        </div>
                      );
                    }}
                    cursor={{
                      stroke: "var(--muted)",
                      strokeWidth: 1,
                      strokeDasharray: "3 3",
                    }}
                  />
                  <Line
                    type="monotoneX"
                    dataKey="cumulativeOutflowsExpected"
                    name="Ожидаемый"
                    stroke="var(--muted)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: "var(--surface)",
                      strokeWidth: 2,
                    }}
                  />
                  {dataFact && (
                    <Line
                      type="monotoneX"
                      dataKey="cumulativeOutflowsFact"
                      name="Факт"
                      stroke="var(--danger)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--danger)", stroke: "var(--surface)", strokeWidth: 2 }}
                      connectNulls={false}
                      activeDot={{
                        r: 5,
                        stroke: "var(--surface)",
                        strokeWidth: 2,
                      }}
                    />
                  )}
                  <Area
                    type="monotoneX"
                    dataKey="cumulativeOutflows"
                    name=""
                    stroke="var(--danger)"
                    fill="var(--danger)"
                    fillOpacity={0.15}
                    strokeWidth={0}
                    legendType="none"
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}
        </div>
        {showPatternHint && usedPatterns && hasEnoughPatternData && (
          <p className="text-xs text-muted-foreground">
            Прогноз адаптирован по дням недели и месяцам на основе ваших
            фактических данных
          </p>
        )}
        {showPatternHint && usedPatterns && !hasEnoughPatternData && (
          <p className="text-xs text-muted-foreground">
            Для адаптации прогноза введите больше фактических данных (минимум 30
            дней)
          </p>
        )}
      </div>
    </div>
  );
}
