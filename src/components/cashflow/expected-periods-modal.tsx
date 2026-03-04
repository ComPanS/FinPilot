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
import { Pencil } from "lucide-react";
import { updateExpense, updateIncome } from "@/app/actions/cashflow";
import { getExpectedChartData } from "@/app/actions/expected-data";

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

type TabId = "manual" | "seasonality";

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
  const [items, setItems] = useState<{ key: string; label: string; amount: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; expected: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [seasonalMultiplier, setSeasonalMultiplier] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

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

  const chartDataDisplay =
    items.length >= 3
      ? (() => {
          const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key));
          const values = sorted.map((i) => i.amount);
          const n = values.length;
          const firstKey = sorted[0]?.key ?? "";
          const lastKey = sorted[n - 1]?.key ?? "";

          const monthIndex = (k: string) => {
            const [y, m] = k.split("-").map(Number);
            return y * 12 + m;
          };

          let slope = 0;
          let intercept = 0;
          if (n >= 2) {
            let sumX = 0;
            let sumY = 0;
            let sumXY = 0;
            let sumX2 = 0;
            for (let i = 0; i < n; i++) {
              sumX += i;
              sumY += values[i];
              sumXY += i * values[i];
              sumX2 += i * i;
            }
            const denom = n * sumX2 - sumX * sumX;
            slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
            intercept = (sumY - slope * sumX) / n;
          }

          const mult = (mk: string) => parseFloat(seasonalMultiplier[mk.split("-")[1] ?? ""] ?? "1") || 1;

          const result: { month: string; expected: number; isPredicted?: boolean }[] = [];
          let extrapIdx = 0;
          for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const item = items.find((it) => it.key === mk);
            let raw = 0;
            let predicted = false;
            if (item) {
              raw = item.amount;
            } else if (mk > lastKey) {
              raw = Math.max(0, Math.round(intercept + slope * (n + extrapIdx)));
              extrapIdx++;
              predicted = true;
            } else if (mk >= firstKey && mk <= lastKey) {
              const prev = sorted.filter((s) => s.key < mk).pop();
              const next = sorted.find((s) => s.key > mk);
              if (prev && next) {
                const distPrev = monthIndex(mk) - monthIndex(prev.key);
                const distTotal = monthIndex(next.key) - monthIndex(prev.key);
                const ratio = distTotal > 0 ? distPrev / distTotal : 0;
                raw = Math.max(0, Math.round(prev.amount + (next.amount - prev.amount) * ratio));
                predicted = true;
              }
            }
            const expected = predicted ? Math.round(raw * mult(mk)) : raw;
            result.push({ month: mk, expected, isPredicted: predicted });
          }
          return result;
        })()
      : chartData.map((d) => {
          const mult = parseFloat(seasonalMultiplier[d.month.split("-")[1] ?? ""] ?? "1") || 1;
          return { ...d, expected: Math.round(d.expected * mult) };
        });

  useEffect(() => {
    const data = existingData ?? {};
    const list = Object.entries(data)
      .filter(([key, v]) => v != null && v > 0 && key >= currentMonthKey)
      .map(([key]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          key,
          label: `${monthNames[m - 1]} ${y}`,
          amount: data[key],
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
    setItems(list);
  }, [entity?.id, addMode, initialData, currentMonthKey, existingData]);

  useEffect(() => {
    if (existingSeasonal && typeof existingSeasonal === "object") {
      setSeasonalMultiplier(
        Object.fromEntries(Object.entries(existingSeasonal).map(([k, v]) => [k, String(v)]))
      );
    } else {
      const def: Record<string, string> = {};
      for (let m = 1; m <= 12; m++) def[String(m).padStart(2, "0")] = "1";
      setSeasonalMultiplier(def);
    }
  }, [entity?.id, existingSeasonal]);

  useEffect(() => {
    if (activeTab === "manual" && entity && !addMode) loadChartData();
  }, [activeTab, entity?.id, addMode, loadChartData]);

  const handleAdd = () => {
    const num = parseFloat(amountInput);
    if (Number.isNaN(num) || num <= 0) return;
    if (selectedMonth < currentMonthKey) return;
    const [y, m] = selectedMonth.split("-").map(Number);
    const label = `${monthNames[m - 1]} ${y}`;
    setItems((prev) => {
      const filtered = prev.filter((i) => i.key !== selectedMonth);
      return [...filtered, { key: selectedMonth, label, amount: num }].sort((a, b) =>
        b.key.localeCompare(a.key)
      );
    });
    setAmountInput("");
  };

  const handleRemove = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (editingKey === key) setEditingKey(null);
  };

  const handleStartEdit = (key: string, amount: number) => {
    setEditingKey(key);
    setEditAmount(String(amount));
  };

  const handleSaveEdit = () => {
    if (!editingKey) return;
    const num = parseFloat(editAmount);
    if (Number.isNaN(num) || num <= 0) return;
    setItems((prev) =>
      prev
        .map((i) => (i.key === editingKey ? { ...i, amount: num } : i))
        .sort((a, b) => b.key.localeCompare(a.key))
    );
    setEditingKey(null);
    setEditAmount("");
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
        const seasonalNums = Object.fromEntries(
          Object.entries(seasonalMultiplier).map(([k, v]) => [k, parseFloat(v) || 1])
        );
        const hasCustomSeasonal = Object.values(seasonalNums).some((v) => v !== 1);
        if (hasCustomSeasonal) {
          updateData.seasonalMultiplier = seasonalNums;
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title = addMode ? "Ожидаемые данные" : `Ожидаемые данные: ${entity?.name ?? ""}`;

  const tabs: { id: TabId; label: string }[] = [
    { id: "manual", label: "Ручной ввод" },
    { id: "seasonality", label: "Сезонность" },
  ];

  const tooltipContentStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  const ChartTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { name: string; value: number; color?: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const [y, m] = (label ?? "").split("-");
    const monthLabel = m ? `${monthNames[Number(m) - 1]} ${y}` : label;
    const isPredicted = (payload[0] as { payload?: { isPredicted?: boolean } })?.payload?.isPredicted;
    return (
      <div style={tooltipContentStyle} className="cursor-pointer px-3 py-2">
        <p className="font-medium" style={{ color: "var(--foreground)" }}>
          {monthLabel}
          {isPredicted && (
            <span className="ml-1 text-xs text-muted-foreground">(прогноз)</span>
          )}
        </p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color ?? "var(--foreground)" }}>
            {entry.name}: {entry.value != null ? Number(entry.value).toLocaleString("ru") : "—"}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl cursor-pointer overflow-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        {!addMode && (
          <div className="mt-4 flex cursor-pointer gap-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`cursor-pointer border-b-2 px-3 py-2 text-sm ${
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
            <div className="mt-4 flex cursor-pointer flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-muted-foreground">Месяц</label>
                <input
                  type="month"
                  min={currentMonthKey}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
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
                  className="mt-1 w-28 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="cursor-pointer rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
              >
                Добавить
              </button>
            </div>

            {items.length > 0 && items.length < 3 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Введите от 3 ожидаемых значений для отображения графика.
              </p>
            )}

            {chartDataDisplay.some((d) => d.expected > 0) && (
              <div className="mt-4 w-full cursor-pointer">
                <p className="mb-1 text-xs text-muted-foreground">
                  График отображается при вводе от 3 ожидаемых значений. Дальнейшие месяцы прогнозируются по тренду. Учитываются коэффициенты сезонности.
                </p>
                <div className="h-48">
                {items.length < 3 && chartLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Загрузка графика…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartDataDisplay}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="month"
                        stroke="var(--foreground)"
                        tick={{ fill: "var(--foreground)", fontSize: 12 }}
                        tickFormatter={(v) => {
                          const [, m] = v.split("-");
                          return monthNames[Number(m) - 1] ?? v;
                        }}
                      />
                      <YAxis
                        stroke="var(--foreground)"
                        tick={{ fill: "var(--foreground)", fontSize: 12 }}
                        tickFormatter={(v) => (v >= 1000 ? `${v / 1000}к` : String(v))}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        wrapperStyle={{ outline: "none" }}
                        contentStyle={{
                          backgroundColor: "var(--surface)",
                          color: "var(--foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                        cursor={{ stroke: "var(--border)" }}
                      />
                      <Legend
                        wrapperStyle={{ color: "var(--foreground)" }}
                        formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
                      />
                      <Line
                        type="monotone"
                        dataKey="expected"
                        name="Ожидаемые"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-4 cursor-pointer overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-2 text-left">Месяц</th>
                      <th className="p-2 text-right">Сумма</th>
                      <th className="w-20 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.key}
                        className="border-b border-border"
                      >
                        <td className="p-2">{it.label}</td>
                        <td className="p-2 text-right">
                          {editingKey === it.key ? (
                            <input
                              type="number"
                              min={0}
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") {
                                  setEditingKey(null);
                                  setEditAmount("");
                                }
                              }}
                              className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-foreground"
                              autoFocus
                            />
                          ) : (
                            `${it.amount.toLocaleString("ru")} ${currency}`
                          )}
                        </td>
                        <td className="p-2">
                          {editingKey === it.key ? (
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="cursor-pointer text-primary hover:underline"
                            >
                              ✓
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(it.key, it.amount)}
                                className="mr-2 cursor-pointer text-muted-foreground hover:text-foreground"
                                title="Редактировать"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(it.key)}
                                className="cursor-pointer text-danger hover:underline"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "seasonality" && (
          <div className="mt-4 cursor-pointer space-y-4">
            <p className="text-sm text-muted-foreground">
              Множитель по месяцам (1.0 = без изменений, 1.2 = +20%, 0.8 = -20%)
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                const val = seasonalMultiplier[m] ?? "1";
                return (
                  <div key={m}>
                    <label className="block text-xs text-muted-foreground">{monthNames[i]}</label>
                    <input
                      type="number"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={val}
                      onChange={(e) => setSeasonalMultiplier((prev) => ({ ...prev, [m]: e.target.value }))}
                      className="mt-1 w-full cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex cursor-pointer justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded border px-4 py-2">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Сохранение…" : addMode ? "Готово" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
