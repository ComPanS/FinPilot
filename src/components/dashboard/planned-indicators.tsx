"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

function monthlyMultiplier(frequency: string, customDays?: number | null): number {
  switch (frequency) {
    case "MONTHLY":
      return 1;
    case "QUARTERLY":
      return 1 / 3;
    case "YEARLY":
      return 1 / 12;
    case "WEEKLY":
      return 52 / 12;
    case "DAILY":
      return 365 / 12;
    case "CUSTOM":
      return customDays && customDays > 0 ? 30 / customDays : 0;
    default:
      return 1;
  }
}

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type Expense = { amount: unknown; frequency: string; customDays?: number | null };
type Income = { amount?: unknown; avgCheck?: unknown; frequency?: string; customDays?: number | null; salesPlan?: unknown };
type ForecastDay = { date: string; inflows: number; outflows: number };

export function PlannedIndicators({
  regularExpenses,
  regularIncomes,
  forecastData,
  currency,
}: {
  regularExpenses: Expense[];
  regularIncomes: Income[];
  forecastData: ForecastDay[];
  currency: string;
}) {
  const expectedExpense = regularExpenses.reduce((sum, e) => {
    const amt = Number(e.amount);
    const mult = monthlyMultiplier(e.frequency, e.customDays);
    return sum + amt * mult;
  }, 0);

  const expectedIncome = regularIncomes.reduce((sum, i) => {
    const amt = Number(i.amount ?? i.avgCheck ?? 0);
    const salesPlan = i.salesPlan as Record<string, number> | null;
    if (salesPlan && Object.values(salesPlan).some((v) => v > 0)) {
      const monthlySum = Object.values(salesPlan).reduce((a, b) => a + b, 0) / 12;
      return sum + monthlySum;
    }
    const freq = i.frequency ?? "MONTHLY";
    const mult = monthlyMultiplier(freq, i.customDays);
    return sum + amt * mult;
  }, 0);

  const expectedProfit = expectedIncome - expectedExpense;

  const monthlyData = (() => {
    const byMonth: Record<string, { inflows: number; outflows: number }> = {};
    for (const d of forecastData) {
      const monthKey = d.date.slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = { inflows: 0, outflows: 0 };
      byMonth[monthKey].inflows += d.inflows;
      byMonth[monthKey].outflows += d.outflows;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          monthKey: key,
          month: monthNames[m - 1] + " " + y,
          inflows: Math.round(v.inflows),
          outflows: Math.round(v.outflows),
          profit: Math.round(v.inflows - v.outflows),
        };
      });
  })();

  const formatValue = (v: number) =>
    Math.round(v).toLocaleString("ru") + " " + currency;

  const tooltipStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  return (
    <div className="space-y-6">
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Ожидаемая прибыль</h3>
          <p className={`mt-2 text-2xl font-bold ${expectedProfit >= 0 ? "text-success" : "text-danger"}`}>
            {formatValue(expectedProfit)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">в месяц</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Ожидаемый доход</h3>
          <p className="mt-2 text-2xl font-bold text-success">{formatValue(expectedIncome)}</p>
          <p className="mt-1 text-xs text-muted-foreground">в месяц</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Ожидаемый расход</h3>
          <p className="mt-2 text-2xl font-bold text-danger">{formatValue(expectedExpense)}</p>
          <p className="mt-1 text-xs text-muted-foreground">в месяц</p>
        </div>
      </div>

      {monthlyData.length > 0 && (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">По месяцам</h3>
            {monthlyData.map((m) => (
              <div key={m.monthKey} className="rounded-xl border border-border bg-surface p-4">
                <h4 className="mb-3 text-base font-semibold text-foreground">{m.month}</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Прибыль</p>
                    <p className={`text-lg font-bold ${m.profit >= 0 ? "text-success" : "text-danger"}`}>
                      {formatValue(m.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Доход</p>
                    <p className="text-lg font-bold text-success">{formatValue(m.inflows)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Расход</p>
                    <p className="text-lg font-bold text-danger">{formatValue(m.outflows)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Прибыль по месяцам</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload;
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">{p?.month}</p>
                          <p style={{ color: (p?.profit ?? 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                            Прибыль: {formatValue(p?.profit ?? 0)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell key={index} fill={entry.profit >= 0 ? "var(--success)" : "var(--danger)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Доход по месяцам</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload;
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">{p?.month}</p>
                          <p style={{ color: "var(--success)" }}>Доход: {formatValue(p?.inflows ?? 0)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="inflows" fill="var(--success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Расход по месяцам</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} />
                  <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload;
                      return (
                        <div style={tooltipStyle} className="px-3 py-2">
                          <p className="font-medium">{p?.month}</p>
                          <p style={{ color: "var(--danger)" }}>Расход: {formatValue(p?.outflows ?? 0)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="outflows" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
