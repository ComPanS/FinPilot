"use client";

import { useState } from "react";
import { DashboardCharts, type VisibleCharts } from "./dashboard-charts-dynamic";

type ForecastDay = {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
};

type ManualTx = { date: string; type: "IN" | "OUT"; amount: number; description?: string };

export function ExpectedChartsSection({
  expectedMonth1Expected,
  expectedMonth2Expected,
  month1Label,
  month2Label,
  currency,
  usedPatterns,
  hasEnoughPatternData,
  manualTransactions = [],
}: {
  expectedMonth1Expected: ForecastDay[];
  expectedMonth2Expected: ForecastDay[];
  month1Label: string;
  month2Label: string;
  currency: string;
  usedPatterns?: boolean;
  hasEnoughPatternData?: boolean;
  manualTransactions?: ManualTx[];
}) {
  const [visibleCharts, setVisibleCharts] = useState<VisibleCharts>({
    balance: false,
    profit: false,
    income: false,
    expense: false,
  });

  const toggleChart = (key: keyof VisibleCharts) => {
    setVisibleCharts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const chartLabels: { key: keyof VisibleCharts; label: string }[] = [
    { key: "balance", label: "Прибыль за месяц" },
    { key: "profit", label: "Прибыль за день" },
    { key: "income", label: "Доход" },
    { key: "expense", label: "Расход" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm text-muted-foreground">Показать графики:</span>
        {chartLabels.map(({ key, label }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={visibleCharts[key] ?? true}
              onChange={() => toggleChart(key)}
              className="h-4 w-4 rounded border-border"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-8">
        {expectedMonth1Expected.length > 0 && (
          <div>
            <h3 className="mb-4 text-base font-medium text-foreground capitalize">
              {month1Label}
            </h3>
            <DashboardCharts
              dataExpected={expectedMonth1Expected}
              currency={currency}
              section={month1Label}
              showPatternHint
              usedPatterns={usedPatterns}
              hasEnoughPatternData={hasEnoughPatternData}
              visibleCharts={visibleCharts}
              manualTransactions={manualTransactions}
            />
          </div>
        )}
        {expectedMonth2Expected.length > 0 && (
          <div>
            <h3 className="mb-4 text-base font-medium text-foreground capitalize">
              {month2Label}
            </h3>
            <DashboardCharts
              dataExpected={expectedMonth2Expected}
              currency={currency}
              section={month2Label}
              showPatternHint
              usedPatterns={usedPatterns}
              hasEnoughPatternData={hasEnoughPatternData}
              visibleCharts={visibleCharts}
              manualTransactions={manualTransactions}
            />
          </div>
        )}
      </div>
    </div>
  );
}
