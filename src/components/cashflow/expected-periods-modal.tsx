"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { updateExpense, updateIncome } from "@/app/actions/cashflow";
import {
  getExpectedChartData,
  generateExpectedFromHistory,
  copyExpectedFromPreviousYear,
} from "@/app/actions/expected-data";

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type ExpenseEntity = {
  id: string;
  name: string;
  amount: unknown;
  frequency: string;
  customDays?: number | null;
  startDate: Date;
  expectedData?: Record<string, number> | null;
  seasonalMultiplier?: Record<string, number> | null;
};
type IncomeEntity = {
  id: string;
  name: string;
  amount?: unknown;
  avgCheck?: unknown;
  frequency?: string;
  customDays?: number | null;
  startDate?: Date | null;
  salesPlan?: unknown;
  expectedData?: Record<string, number> | null;
  seasonalMultiplier?: Record<string, number> | null;
};

type TabId = "manual" | "auto" | "seasonality";

export function ExpectedPeriodsModal({
  entityType,
  entity,
  currency,
  profileId,
  onClose,
  onSuccess,
  addMode,
  initialData,
  onSaveForAdd,
}: {
  entityType: "EXPENSE" | "INCOME";
  entity?: ExpenseEntity | IncomeEntity | null;
  currency: string;
  profileId: string;
  onClose: () => void;
  onSuccess?: () => void;
  addMode?: boolean;
  initialData?: Record<string, number>;
  onSaveForAdd?: (data: Record<string, number>) => void;
}) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [activeTab, setActiveTab] = useState<TabId>("manual");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [amountInput, setAmountInput] = useState("");
  const [items, setItems] = useState<{ key: string; label: string; amount: number; isPast?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; expected: number; actual: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [seasonalMultiplier, setSeasonalMultiplier] = useState<Record<string, number>>({});

  const existingData = addMode
    ? initialData
    : (entity
        ? ((entity as ExpenseEntity).expectedData ?? (entity as IncomeEntity).expectedData)
        : undefined) as Record<string, number> | null | undefined;
  const existingSeasonal =
    (entity && ((entity as ExpenseEntity).seasonalMultiplier ?? (entity as IncomeEntity).seasonalMultiplier)) as
      | Record<string, number>
      | null
      | undefined;

  const loadChartData = useCallback(async () => {
    if (addMode || !entity) return;
    setChartLoading(true);
    const res = await getExpectedChartData(profileId, entity.id, entityType);
    setChartLoading(false);
    if (res && "data" in res && res.data) setChartData(res.data);
  }, [profileId, entity?.id, entityType, addMode]);

  useEffect(() => {
    const data = existingData ?? {};
    const list = Object.entries(data)
      .filter(([key, v]) => v != null && v > 0)
      .map(([key]) => {
        const [y, m] = key.split("-").map(Number);
        const isPast = key < currentMonthKey;
        return {
          key,
          label: `${monthNames[m - 1]} ${y}${isPast ? " (прошлый)" : ""}`,
          amount: data[key],
          isPast,
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    setItems(list);
  }, [entity?.id, addMode, initialData, currentMonthKey, existingData]);

  useEffect(() => {
    if (existingSeasonal && typeof existingSeasonal === "object") {
      setSeasonalMultiplier(existingSeasonal);
    } else {
      const def: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) def[String(m).padStart(2, "0")] = 1;
      setSeasonalMultiplier(def);
    }
  }, [entity?.id, existingSeasonal]);

  useEffect(() => {
    if (activeTab === "manual" && entity && !addMode) loadChartData();
  }, [activeTab, entity?.id, addMode, loadChartData]);

  const handleAdd = () => {
    const num = parseFloat(amountInput);
    if (Number.isNaN(num) || num <= 0) return;
    const [y, m] = selectedMonth.split("-").map(Number);
    const isPast = selectedMonth < currentMonthKey;
    const label = `${monthNames[m - 1]} ${y}${isPast ? " (прошлый)" : ""}`;
    setItems((prev) => {
      const filtered = prev.filter((i) => i.key !== selectedMonth);
      return [...filtered, { key: selectedMonth, label, amount: num, isPast }].sort((a, b) =>
        a.key.localeCompare(b.key)
      );
    });
    setAmountInput("");
  };

  const handleRemove = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const handleSave = async () => {
    const expectedData: Record<string, number> = {};
    for (const it of items) {
      expectedData[it.key] = it.amount;
    }
    setSaving(true);
    try {
      if (addMode && onSaveForAdd) {
        onSaveForAdd(expectedData);
        onClose();
      } else if (entity) {
        const updateData: { expectedData: Record<string, number>; seasonalMultiplier?: Record<string, number> } = {
          expectedData: Object.keys(expectedData).length > 0 ? expectedData : {},
        };
        const hasCustomSeasonal = Object.values(seasonalMultiplier).some((v) => v !== 1);
        if (hasCustomSeasonal) {
          updateData.seasonalMultiplier = seasonalMultiplier;
        }
        if (entityType === "EXPENSE") {
          await updateExpense((entity as ExpenseEntity).id, updateData);
        } else {
          await updateIncome((entity as IncomeEntity).id, updateData);
        }
        onSuccess?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFillByTrend = async () => {
    if (!entity) return;
    setAutoGenerating(true);
    const res = await generateExpectedFromHistory(profileId, entity.id, entityType, 6);
    setAutoGenerating(false);
    if (res && "generated" in res && res.generated) {
      const list = Object.entries(res.generated).map(([key, amount]) => {
        const [y, m] = key.split("-").map(Number);
        const isPast = key < currentMonthKey;
        return {
          key,
          label: `${monthNames[m - 1]} ${y}${isPast ? " (прошлый)" : ""}`,
          amount,
          isPast,
        };
      });
      setItems((prev) => {
        const byKey = new Map(prev.map((i) => [i.key, i]));
        for (const it of list) byKey.set(it.key, it);
        return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
      });
      loadChartData();
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!entity) return;
    setCopying(true);
    const res = await copyExpectedFromPreviousYear(
      profileId,
      entity.id,
      entityType,
      now.getFullYear(),
      Object.keys(seasonalMultiplier).length > 0 ? seasonalMultiplier : undefined
    );
    setCopying(false);
    if (res && "expectedData" in res) {
      const data = res.expectedData as Record<string, number>;
      const list = Object.entries(data)
        .filter(([_, v]) => v != null && v > 0)
        .map(([key]) => {
          const [y, m] = key.split("-").map(Number);
          const isPast = key < currentMonthKey;
          return {
            key,
            label: `${monthNames[m - 1]} ${y}${isPast ? " (прошлый)" : ""}`,
            amount: data[key],
            isPast,
          };
        })
        .sort((a, b) => a.key.localeCompare(b.key));
      setItems(list);
      onSuccess?.();
      loadChartData();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title = addMode ? "Ожидаемые данные" : `Ожидаемые данные: ${entity?.name ?? ""}`;

  const tabs: { id: TabId; label: string }[] = [
    { id: "manual", label: "Ручной ввод" },
    { id: "auto", label: "Авто из истории" },
    { id: "seasonality", label: "Сезонность" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        {!addMode && (
          <div className="mt-4 flex gap-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`border-b-2 px-3 py-2 text-sm ${
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "manual" && (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-muted-foreground">Месяц</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-1 rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Сумма ({currency})</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    else if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  className="mt-1 w-28 rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
              >
                Добавить
              </button>
              {!addMode && entity && (
                <button
                  type="button"
                  onClick={handleFillByTrend}
                  disabled={autoGenerating}
                  className="rounded border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-50"
                >
                  {autoGenerating ? "Расчёт…" : "Заполнить по тренду"}
                </button>
              )}
            </div>

            {!addMode && entity && chartData.length > 0 && (
              <div className="mt-4 h-48 w-full">
                {chartLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Загрузка графика…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v) => {
                          const [, m] = v.split("-");
                          return monthNames[Number(m) - 1] ?? v;
                        }}
                      />
                      <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}к` : String(v))} />
                      <Tooltip
                        formatter={(value: number | undefined) => [value != null ? value.toLocaleString("ru") : "", ""]}
                        labelFormatter={(label) => {
                          const [y, m] = label.split("-");
                          return `${monthNames[Number(m) - 1]} ${y}`;
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="expected"
                        name="Ожидаемые"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Фактические (профиль)"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-2 text-left">Месяц</th>
                      <th className="p-2 text-right">Сумма</th>
                      <th className="w-10 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.key}
                        className={`border-b border-border ${it.isPast ? "text-muted-foreground" : ""}`}
                      >
                        <td className="p-2">{it.label}</td>
                        <td className="p-2 text-right">
                          {it.amount.toLocaleString("ru")} {currency}
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => handleRemove(it.key)}
                            className="cursor-pointer text-danger hover:underline"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "auto" && !addMode && entity && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Автогенерация на основе последних 12 месяцев. Линейный тренд экстраполируется на 6 месяцев вперёд.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleFillByTrend}
                disabled={autoGenerating}
                className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {autoGenerating ? "Расчёт…" : "Заполнить по тренду"}
              </button>
              <button
                type="button"
                onClick={handleCopyFromPreviousYear}
                disabled={copying}
                className="rounded border border-border px-4 py-2 hover:bg-surface disabled:opacity-50"
              >
                {copying ? "Копирование…" : "Копировать с прошлого года"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "seasonality" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Множитель по месяцам (1.0 = без изменений, 1.2 = +20%, 0.8 = -20%)
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                const val = seasonalMultiplier[m] ?? 1;
                return (
                  <div key={m}>
                    <label className="block text-xs text-muted-foreground">{monthNames[i]}</label>
                    <input
                      type="number"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={val}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v))
                          setSeasonalMultiplier((prev) => ({ ...prev, [m]: v }));
                      }}
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Сохранение…" : addMode ? "Готово" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
