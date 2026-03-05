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

export function DashboardCharts({
  dataExpected,
  dataFact,
  currency,
  section,
  showPatternHint,
  usedPatterns,
  hasEnoughPatternData,
}: {
  dataExpected: ForecastDay[];
  dataFact?: ForecastDayFact[];
  currency: string;
  section?: string;
  showPatternHint?: boolean;
  usedPatterns?: boolean;
  hasEnoughPatternData?: boolean;
}) {
  const baseChartData = useMemo(() => {
    const factByDate = dataFact
      ? new Map(dataFact.map((d) => [d.date, d]))
      : null;
    const hasFactData = factByDate != null && factByDate.size > 0;
    const initialBalance =
      dataExpected.length > 0
        ? dataExpected[0].balance - dataExpected[0].inflows + dataExpected[0].outflows
        : 0;

    let runningBalance = initialBalance;
    let cumIn = 0;
    let cumOut = 0;
    let lastCumInFact = 0;
    let lastCumOutFact = 0;

    return dataExpected.reduce<ChartPoint[]>((acc, d) => {
      const inflows = Math.round(d.inflows);
      const outflows = Math.round(d.outflows);
      const profit = Math.round(d.inflows - d.outflows);
      const prev = acc[acc.length - 1];
      const cumulativeInflows = (prev?.cumulativeInflows ?? 0) + inflows;
      const cumulativeOutflows = (prev?.cumulativeOutflows ?? 0) + outflows;

      const fact = factByDate?.get(d.date);

      // Гибрид: на днях с фактом — факт, на остальных — ожидаемое
      let balanceExpected: number;
      let profitExpected: number;
      let cumulativeInflowsExpected: number;
      let cumulativeOutflowsExpected: number;

      if (hasFactData && fact?.hasFactData) {
        // День с фактом — гибрид: факт где есть, иначе ожидаемое
        const inVal = fact.inflows ?? inflows;
        const outVal = fact.outflows ?? outflows;
        cumIn += inVal;
        cumOut += outVal;
        if (fact.inflows != null) lastCumInFact += fact.inflows;
        if (fact.outflows != null) lastCumOutFact += fact.outflows;
        if (fact.balance != null) {
          runningBalance = Math.round(fact.balance);
        } else {
          runningBalance = runningBalance + inVal - outVal;
        }
        balanceExpected = Math.round(runningBalance);
        profitExpected = Math.round(inVal - outVal);
        // На днях с фактом — совпадаем с линией факта; иначе продолжаем от предыдущего
        cumulativeInflowsExpected =
          fact.inflows != null
            ? lastCumInFact
            : (prev?.cumulativeInflowsExpected ?? 0) + inflows;
        cumulativeOutflowsExpected =
          fact.outflows != null
            ? lastCumOutFact
            : (prev?.cumulativeOutflowsExpected ?? 0) + outflows;
      } else {
        // День без факта — ожидаемое
        cumIn += inflows;
        cumOut += outflows;
        runningBalance += inflows - outflows;
        balanceExpected = Math.round(runningBalance);
        profitExpected = profit;
        cumulativeInflowsExpected =
          (prev?.cumulativeInflowsExpected ?? 0) + inflows;
        cumulativeOutflowsExpected =
          (prev?.cumulativeOutflowsExpected ?? 0) + outflows;
      }

      // Для Area используем гибридные значения при наличии dataFact
      const balanceForArea = hasFactData ? balanceExpected : Math.round(d.balance);
      const positiveBalance = balanceForArea >= 0 ? balanceForArea : 0;
      const negativeBalance = balanceForArea < 0 ? balanceForArea : 0;
      const cumulativeInflowsForArea = hasFactData ? cumulativeInflowsExpected : cumulativeInflows;
      const cumulativeOutflowsForArea = hasFactData ? cumulativeOutflowsExpected : cumulativeOutflows;

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
        cumulativeInflowsExpected,
        cumulativeOutflowsExpected,
      };

      // profitFact, cumulativeInflowsFact, cumulativeOutflowsFact, balanceFact
      if (fact?.hasFactData) {
        point.profitFact =
          fact.inflows != null && fact.outflows != null
            ? Math.round(fact.inflows - fact.outflows)
            : null;
        point.cumulativeInflowsFact =
          fact.inflows != null ? lastCumInFact : null;
        point.cumulativeOutflowsFact =
          fact.outflows != null ? lastCumOutFact : null;
        point.balanceFact =
          fact.balance != null ? Math.round(fact.balance) : null;
      } else {
        point.profitFact = null;
        point.cumulativeInflowsFact = null;
        point.cumulativeOutflowsFact = null;
        point.balanceFact = null;
      }

      acc.push(point);
      return acc;
    }, []);
  }, [dataExpected, dataFact]);

  const chartDataWithProfitCrossings = baseChartData;
  const chartDataWithBalanceCrossings = baseChartData;
  const chartData = baseChartData;

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
    return s + inflows;
  }, 0);
  const totalExpense = chartData.reduce((s, d) => {
    const fact = factByDateForTotals?.get(d.date);
    const outflows =
      fact?.hasFactData && fact.outflows != null ? fact.outflows : d.outflows;
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
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
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
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="font-medium">
                          Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                        </p>
                        <p className="text-muted-foreground">
                          Ожидаемый: {formatValue(balanceExp)}
                        </p>
                        {dataFact && (
                          <p
                            style={{
                              color:
                                (balanceFact ?? 0) >= 0
                                  ? "var(--success)"
                                  : "var(--danger)",
                            }}
                          >
                            Факт:{" "}
                            {balanceFact != null
                              ? formatValue(balanceFact)
                              : "—"}
                          </p>
                        )}
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
                    dot={false}
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

        <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Прибыль за день
          </h3>
          <div className="h-80 min-h-[320px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
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
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="font-medium">
                          Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                        </p>
                        <p className="text-muted-foreground">
                          Ожидаемый: {formatValue(profitExp)}
                        </p>
                        {dataFact && (
                          <p
                            style={{
                              color:
                                (profitFact ?? 0) >= 0
                                  ? "var(--success)"
                                  : "var(--danger)",
                            }}
                          >
                            Факт:{" "}
                            {profitFact != null ? formatValue(profitFact) : "—"}
                          </p>
                        )}
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
                    dot={false}
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

        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Доход
            </h3>
            <div className="h-80 min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
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
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">
                            Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                          </p>
                          <p className="text-muted-foreground">
                            Ожидаемый: {formatValue(cumInExp)}
                          </p>
                          {dataFact && (
                            <p style={{ color: "var(--success)" }}>
                              Факт:{" "}
                              {cumInFact != null ? formatValue(cumInFact) : "—"}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            За день: {formatValue(p?.inflows ?? 0)}
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
                      dot={false}
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

          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Расход
            </h3>
            <div className="h-80 min-h-[320px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
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
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">
                            Дата: {p?.date ? formatDateDdMmYyyy(p.date) : ""}
                          </p>
                          <p className="text-muted-foreground">
                            Ожидаемый: {formatValue(cumOutExp)}
                          </p>
                          {dataFact && (
                            <p style={{ color: "var(--danger)" }}>
                              Факт:{" "}
                              {cumOutFact != null
                                ? formatValue(cumOutFact)
                                : "—"}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            За день: {formatValue(p?.outflows ?? 0)}
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
                      dot={false}
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
