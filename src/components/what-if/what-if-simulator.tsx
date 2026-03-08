"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { getForecastAction } from "@/app/actions/forecast";
import { saveScenarioAction, deleteScenarioAction } from "@/app/actions/what-if";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { formatDateDdMmYyyy } from "@/lib/date-utils";
import type { WhatIfChanges } from "@/types";

const FREQ_LABELS: Record<string, string> = {
  DAILY: "ежедневно",
  WEEKLY: "еженедельно",
  MONTHLY: "ежемесячно",
  QUARTERLY: "ежеквартально",
  YEARLY: "ежегодно",
  CUSTOM: "кастом",
};

type ForecastDay = { date: string; balance: number; inflows: number; outflows: number };

type Profile = {
  id: string;
  regularExpenses: Array<{ id: string; name: string; amount: number; frequency: string; categoryId: string; category?: { id: string; name: string } }>;
  regularIncomes: Array<{ id: string; name: string; amount?: number; avgCheck?: number; taxes?: number; frequency: string; categoryId?: string; category?: { id: string; name: string } }>;
  manualTransactions: Array<{ id: string; date: string; type: "IN" | "OUT"; amount: number; description?: string; expenseCategoryId?: string; incomeCategoryId?: string }>;
};

type Scenario = { id: string; name: string; changesJson: unknown; createdAt: Date };

type ExpenseCategory = { id: string; name: string };
type IncomeCategory = { id: string; name: string };

function getTwoNextMonths(): { month1: { startDate: string; days: number; label: string }; month2: { startDate: string; days: number; label: string } } {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const days1 = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  const days2 = new Date(now.getFullYear(), now.getMonth() + 3, 0).getDate();
  const start1 = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const start2 = `${monthAfterNext.getFullYear()}-${String(monthAfterNext.getMonth() + 1).padStart(2, "0")}-01`;
  const label1 = nextMonth.toLocaleDateString("ru", { month: "long", year: "numeric" });
  const label2 = monthAfterNext.toLocaleDateString("ru", { month: "long", year: "numeric" });
  return {
    month1: { startDate: start1, days: days1, label: label1 },
    month2: { startDate: start2, days: days2, label: label2 },
  };
}

export function WhatIfSimulator({
  profile,
  expenseCategories,
  incomeCategories,
  scenarios,
  currency,
  scenarioLimit = 10,
}: {
  profile: Profile;
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
  scenarios: Scenario[];
  currency: string;
  scenarioLimit?: number;
}) {
  const { month1, month2 } = getTwoNextMonths();

  const [incomeGrowth, setIncomeGrowth] = useState<string>("0");
  const [expenseGrowth, setExpenseGrowth] = useState<string>("0");
  const [expenseOverrides, setExpenseOverrides] = useState<Record<string, { amount?: number; hidden?: boolean }>>({});
  const [incomeOverrides, setIncomeOverrides] = useState<Record<string, { amount?: number; hidden?: boolean }>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<string, { amount?: number; hidden?: boolean }>>({});
  const [addExpenses, setAddExpenses] = useState<WhatIfChanges["addExpenses"]>([]);
  const [addIncomes, setAddIncomes] = useState<WhatIfChanges["addIncomes"]>([]);
  const [addManual, setAddManual] = useState<WhatIfChanges["addManual"]>([]);

  const [baselineMonth1, setBaselineMonth1] = useState<ForecastDay[] | null>(null);
  const [baselineMonth2, setBaselineMonth2] = useState<ForecastDay[] | null>(null);
  const [scenarioMonth1, setScenarioMonth1] = useState<ForecastDay[] | null>(null);
  const [scenarioMonth2, setScenarioMonth2] = useState<ForecastDay[] | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null);
  const [loadedScenarioId, setLoadedScenarioId] = useState<string | null>(null);

  const buildChanges = useCallback((): WhatIfChanges => {
    const changes: WhatIfChanges = {};
    const incGrowth = Number(incomeGrowth) || 0;
    const expGrowth = Number(expenseGrowth) || 0;
    if (incGrowth !== 0) changes.incomeGrowthPercent = incGrowth;
    if (expGrowth !== 0) changes.expenseGrowthPercent = expGrowth;
    const expOver: Record<string, { amount?: number; hidden?: boolean }> = {};
    for (const [id, v] of Object.entries(expenseOverrides)) {
      if (v.hidden || v.amount !== undefined) expOver[id] = v;
    }
    if (Object.keys(expOver).length > 0) changes.expenseOverrides = expOver;
    const incOver: Record<string, { amount?: number; hidden?: boolean }> = {};
    for (const [id, v] of Object.entries(incomeOverrides)) {
      if (v.hidden || v.amount !== undefined) incOver[id] = v;
    }
    if (Object.keys(incOver).length > 0) changes.incomeOverrides = incOver;
    const manOver: Record<string, { amount?: number; hidden?: boolean }> = {};
    for (const [id, v] of Object.entries(manualOverrides)) {
      if (v.hidden || v.amount !== undefined) manOver[id] = v;
    }
    if (Object.keys(manOver).length > 0) changes.manualOverrides = manOver;
    if (addExpenses?.length) changes.addExpenses = addExpenses;
    if (addIncomes?.length) changes.addIncomes = addIncomes;
    if (addManual?.length) changes.addManual = addManual;
    return changes;
  }, [incomeGrowth, expenseGrowth, expenseOverrides, incomeOverrides, manualOverrides, addExpenses, addIncomes, addManual]);

  const loadForecasts = useCallback(async () => {
    const changes = buildChanges();
    const [base1, base2, scen1, scen2] = await Promise.all([
      getForecastAction(profile.id, { days: month1.days, startDate: month1.startDate, useExpectedData: true }),
      getForecastAction(profile.id, { days: month2.days, startDate: month2.startDate, useExpectedData: true }),
      getForecastAction(profile.id, { days: month1.days, startDate: month1.startDate, changes, useExpectedData: true }),
      getForecastAction(profile.id, { days: month2.days, startDate: month2.startDate, changes, useExpectedData: true }),
    ]);
    if (base1?.forecast) setBaselineMonth1(base1.forecast);
    if (base2?.forecast) setBaselineMonth2(base2.forecast);
    if (scen1?.forecast) setScenarioMonth1(scen1.forecast);
    if (scen2?.forecast) setScenarioMonth2(scen2.forecast);
  }, [profile.id, month1, month2, buildChanges]);


  const loadScenario = (s: Scenario) => {
    const c = s.changesJson as WhatIfChanges;
    setIncomeGrowth(String(c.incomeGrowthPercent ?? 0));
    setExpenseGrowth(String(c.expenseGrowthPercent ?? 0));
    setExpenseOverrides(c.expenseOverrides ?? {});
    setIncomeOverrides(c.incomeOverrides ?? {});
    setManualOverrides(c.manualOverrides ?? {});
    setAddExpenses(c.addExpenses ?? []);
    setAddIncomes(c.addIncomes ?? []);
    setAddManual(c.addManual ?? []);
    setLoadedScenarioId(s.id);
  };

  const loadForecastsRef = useRef(loadForecasts);
  useEffect(() => {
    loadForecastsRef.current = loadForecasts;
  });
  useEffect(() => {
    if (loadedScenarioId) loadForecastsRef.current();
  }, [loadedScenarioId]);

  const baseline = baselineMonth1 && baselineMonth2 ? [...baselineMonth1, ...baselineMonth2] : null;
  const scenarioForecast = scenarioMonth1 && scenarioMonth2 ? [...scenarioMonth1, ...scenarioMonth2] : null;
  const hasForecast = baseline && scenarioForecast;

  const formatValue = (v: number) => Math.round(v).toLocaleString("ru") + " " + currency;

  const totalIncome = (data: ForecastDay[]) => data.reduce((s, d) => s + d.inflows, 0);
  const totalExpense = (data: ForecastDay[]) => data.reduce((s, d) => s + d.outflows, 0);
  const totalProfit = (data: ForecastDay[]) => totalIncome(data) - totalExpense(data);

  const baselineProfit1 = baselineMonth1 ? totalProfit(baselineMonth1) : 0;
  const scenarioProfit1 = scenarioMonth1 ? totalProfit(scenarioMonth1) : 0;
  const baselineIncome1 = baselineMonth1 ? totalIncome(baselineMonth1) : 0;
  const scenarioIncome1 = scenarioMonth1 ? totalIncome(scenarioMonth1) : 0;
  const baselineExpense1 = baselineMonth1 ? totalExpense(baselineMonth1) : 0;
  const scenarioExpense1 = scenarioMonth1 ? totalExpense(scenarioMonth1) : 0;

  const baselineProfit2 = baselineMonth2 ? totalProfit(baselineMonth2) : 0;
  const scenarioProfit2 = scenarioMonth2 ? totalProfit(scenarioMonth2) : 0;
  const baselineIncome2 = baselineMonth2 ? totalIncome(baselineMonth2) : 0;
  const scenarioIncome2 = scenarioMonth2 ? totalIncome(scenarioMonth2) : 0;
  const baselineExpense2 = baselineMonth2 ? totalExpense(baselineMonth2) : 0;
  const scenarioExpense2 = scenarioMonth2 ? totalExpense(scenarioMonth2) : 0;

  const [addFormOpen, setAddFormOpen] = useState<"expense" | "income" | "manual" | null>(null);
  const [editingAdd, setEditingAdd] = useState<{ type: "expense" | "income" | "manual"; index: number } | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold">Изменения в планировщике</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Скрыть или изменить сумму — только для сценария. Без сохранения в БД.
        </p>

        <div className="mt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium">Регулярные расходы</h4>
            <ul className="mt-2 space-y-2">
              {profile.regularExpenses.map((e) => {
                const ov = expenseOverrides[e.id] ?? {};
                return (
                  <li key={e.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!ov.hidden}
                      onChange={(ev) => {
                        setExpenseOverrides((prev) => ({
                          ...prev,
                          [e.id]: { ...prev[e.id], hidden: ev.target.checked },
                        }));
                      }}
                    />
                    <span className={ov.hidden ? "line-through text-muted-foreground" : ""}>{e.name}</span>
                    <input
                      type="number"
                      placeholder={String(e.amount)}
                      value={ov.amount ?? ""}
                      onChange={(ev) => {
                        const v = ev.target.value ? Number(ev.target.value) : undefined;
                        setExpenseOverrides((prev) => ({
                          ...prev,
                          [e.id]: { ...prev[e.id], amount: v },
                        }));
                      }}
                      className="min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium">Регулярные доходы</h4>
            <ul className="mt-2 space-y-2">
              {profile.regularIncomes.map((i) => {
                const ov = incomeOverrides[i.id] ?? {};
                const amt = i.amount ?? i.avgCheck ?? 0;
                return (
                  <li key={i.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!ov.hidden}
                      onChange={(ev) => {
                        setIncomeOverrides((prev) => ({
                          ...prev,
                          [i.id]: { ...prev[i.id], hidden: ev.target.checked },
                        }));
                      }}
                    />
                    <span className={ov.hidden ? "line-through text-muted-foreground" : ""}>{i.name}</span>
                    <input
                      type="number"
                      placeholder={String(amt)}
                      value={ov.amount ?? ""}
                      onChange={(ev) => {
                        const v = ev.target.value ? Number(ev.target.value) : undefined;
                        setIncomeOverrides((prev) => ({
                          ...prev,
                          [i.id]: { ...prev[i.id], amount: v },
                        }));
                      }}
                      className="min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium">Разовые операции</h4>
            <ul className="mt-2 space-y-2">
              {profile.manualTransactions.map((t) => {
                const ov = manualOverrides[t.id] ?? {};
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!ov.hidden}
                      onChange={(ev) => {
                        setManualOverrides((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], hidden: ev.target.checked },
                        }));
                      }}
                    />
                    <span className={ov.hidden ? "line-through text-muted-foreground" : ""}>
                      {formatDateDdMmYyyy(t.date)} {t.type === "IN" ? "Доход" : "Расход"} {t.amount}
                      {t.description ? ` — ${t.description}` : ""}
                    </span>
                    <input
                      type="number"
                      placeholder={String(t.amount)}
                      value={ov.amount ?? ""}
                      onChange={(ev) => {
                        const v = ev.target.value ? Number(ev.target.value) : undefined;
                        setManualOverrides((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], amount: v },
                        }));
                      }}
                      className="min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium">Добавить</h4>
            <p className="mt-1 text-xs text-muted-foreground">Создаются только в сценарии</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {addFormOpen === null && (
                <>
                  <button type="button" onClick={() => setAddFormOpen("expense")} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">
                    + Добавить расход
                  </button>
                  <button type="button" onClick={() => setAddFormOpen("income")} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">
                    + Добавить доход
                  </button>
                  <button type="button" onClick={() => setAddFormOpen("manual")} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted">
                    + Добавить разовую
                  </button>
                </>
              )}
              {addFormOpen === "expense" && (
                <AddExpenseForm
                  categories={expenseCategories}
                  onAdd={(item) => {
                    setAddExpenses((prev) => [...(prev ?? []), item]);
                    setAddFormOpen(null);
                  }}
                  onCancel={() => setAddFormOpen(null)}
                />
              )}
              {addFormOpen === "income" && (
                <AddIncomeForm
                  categories={incomeCategories}
                  onAdd={(item) => {
                    setAddIncomes((prev) => [...(prev ?? []), item]);
                    setAddFormOpen(null);
                  }}
                  onCancel={() => setAddFormOpen(null)}
                />
              )}
              {addFormOpen === "manual" && (
                <AddManualForm
                  onAdd={(item) => {
                    setAddManual((prev) => [...(prev ?? []), item]);
                    setAddFormOpen(null);
                  }}
                  onCancel={() => setAddFormOpen(null)}
                />
              )}
            </div>
            {(addExpenses?.length ?? 0) > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {addExpenses?.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {editingAdd?.type === "expense" && editingAdd.index === i ? (
                      <EditExpenseForm
                        item={a}
                        categories={expenseCategories}
                        onSave={(updated) => {
                          setAddExpenses((prev) => {
                            const next = [...(prev ?? [])];
                            next[i] = updated;
                            return next;
                          });
                          setEditingAdd(null);
                        }}
                        onCancel={() => setEditingAdd(null)}
                      />
                    ) : (
                      <>
                        <span className="text-danger">+ {a.name} {a.amount} {FREQ_LABELS[a.frequency] ?? a.frequency}</span>
                        <button type="button" onClick={() => setEditingAdd({ type: "expense", index: i })} className="text-primary hover:underline">изменить</button>
                        <button type="button" onClick={() => setAddExpenses((prev) => prev?.filter((_, j) => j !== i) ?? [])} className="text-danger hover:underline">удалить</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(addIncomes?.length ?? 0) > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {addIncomes?.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {editingAdd?.type === "income" && editingAdd.index === i ? (
                      <EditIncomeForm
                        item={a}
                        categories={incomeCategories}
                        onSave={(updated) => {
                          setAddIncomes((prev) => {
                            const next = [...(prev ?? [])];
                            next[i] = updated;
                            return next;
                          });
                          setEditingAdd(null);
                        }}
                        onCancel={() => setEditingAdd(null)}
                      />
                    ) : (
                      <>
                        <span className="text-success">+ {a.name} {a.amount} {FREQ_LABELS[a.frequency] ?? a.frequency}</span>
                        <button type="button" onClick={() => setEditingAdd({ type: "income", index: i })} className="text-primary hover:underline">изменить</button>
                        <button type="button" onClick={() => setAddIncomes((prev) => prev?.filter((_, j) => j !== i) ?? [])} className="text-danger hover:underline">удалить</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(addManual?.length ?? 0) > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {addManual?.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {editingAdd?.type === "manual" && editingAdd.index === i ? (
                      <EditManualForm
                        item={a}
                        onSave={(updated) => {
                          setAddManual((prev) => {
                            const next = [...(prev ?? [])];
                            next[i] = updated;
                            return next;
                          });
                          setEditingAdd(null);
                        }}
                        onCancel={() => setEditingAdd(null)}
                      />
                    ) : (
                      <>
                        <span className={a.type === "OUT" ? "text-danger" : "text-success"}>
                          + {formatDateDdMmYyyy(a.date)} {a.type === "IN" ? "Доход" : "Расход"} {a.amount}
                          {a.description ? ` — ${a.description}` : ""}
                        </span>
                        <button type="button" onClick={() => setEditingAdd({ type: "manual", index: i })} className="text-primary hover:underline">изменить</button>
                        <button type="button" onClick={() => setAddManual((prev) => prev?.filter((_, j) => j !== i) ?? [])} className="text-danger hover:underline">удалить</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium">Рост дохода (%)</label>
              <input
                type="number"
                value={incomeGrowth}
                onChange={(e) => setIncomeGrowth(e.target.value)}
                placeholder="0"
                className="mt-1 min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Рост расходов (%)</label>
              <input
                type="number"
                value={expenseGrowth}
                onChange={(e) => setExpenseGrowth(e.target.value)}
                placeholder="0"
                className="mt-1 min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1"
              />
            </div>
          </div>
          <button
            onClick={loadForecasts}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Пересчитать
          </button>
        </div>
      </div>

      {hasForecast && baselineMonth1 && scenarioMonth1 && baselineMonth2 && scenarioMonth2 && (
        <div className="grid gap-6 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
          <div>
            <h4 className="mb-3 font-medium capitalize">{month1.label}</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Прибыль</span>
                <p className="font-medium">Базовый: {formatValue(baselineProfit1)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioProfit1)}</p>
                <p className={scenarioProfit1 - baselineProfit1 >= 0 ? "text-success" : "text-danger"}>
                  {scenarioProfit1 - baselineProfit1 >= 0 ? "+" : ""}{formatValue(scenarioProfit1 - baselineProfit1)}
                </p>
              </div>
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Доход</span>
                <p className="font-medium">Базовый: {formatValue(baselineIncome1)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioIncome1)}</p>
                <p className={scenarioIncome1 - baselineIncome1 >= 0 ? "text-success" : "text-danger"}>
                  {scenarioIncome1 - baselineIncome1 >= 0 ? "+" : ""}{formatValue(scenarioIncome1 - baselineIncome1)}
                </p>
              </div>
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Расход</span>
                <p className="font-medium">Базовый: {formatValue(baselineExpense1)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioExpense1)}</p>
                <p className={scenarioExpense1 - baselineExpense1 <= 0 ? "text-success" : "text-danger"}>
                  {scenarioExpense1 - baselineExpense1 <= 0 ? "" : "+"}{formatValue(scenarioExpense1 - baselineExpense1)}
                </p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="mb-3 font-medium capitalize">{month2.label}</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Прибыль</span>
                <p className="font-medium">Базовый: {formatValue(baselineProfit2)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioProfit2)}</p>
                <p className={scenarioProfit2 - baselineProfit2 >= 0 ? "text-success" : "text-danger"}>
                  {scenarioProfit2 - baselineProfit2 >= 0 ? "+" : ""}{formatValue(scenarioProfit2 - baselineProfit2)}
                </p>
              </div>
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Доход</span>
                <p className="font-medium">Базовый: {formatValue(baselineIncome2)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioIncome2)}</p>
                <p className={scenarioIncome2 - baselineIncome2 >= 0 ? "text-success" : "text-danger"}>
                  {scenarioIncome2 - baselineIncome2 >= 0 ? "+" : ""}{formatValue(scenarioIncome2 - baselineIncome2)}
                </p>
              </div>
              <div className="rounded border border-border p-2">
                <span className="text-muted-foreground">Расход</span>
                <p className="font-medium">Базовый: {formatValue(baselineExpense2)}</p>
                <p className="font-medium">Сценарий: {formatValue(scenarioExpense2)}</p>
                <p className={scenarioExpense2 - baselineExpense2 <= 0 ? "text-success" : "text-danger"}>
                  {scenarioExpense2 - baselineExpense2 <= 0 ? "" : "+"}{formatValue(scenarioExpense2 - baselineExpense2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasForecast && baselineMonth1 && scenarioMonth1 && baselineMonth2 && scenarioMonth2 && (
        <div className="space-y-8">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="mb-4 font-semibold capitalize">{month1.label}</h3>
            <WhatIfComparisonChart
              baseline={baselineMonth1}
              scenario={scenarioMonth1}
              currency={currency}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="mb-4 font-semibold capitalize">{month2.label}</h3>
            <WhatIfComparisonChart
              baseline={baselineMonth2}
              scenario={scenarioMonth2}
              currency={currency}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold">Сохранить сценарий</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          До {scenarioLimit} сценариев на вашем тарифе. Текущие настройки будут сохранены.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Название сценария"
            className="rounded border border-border px-3 py-2"
          />
          <button
            onClick={async () => {
              if (!scenarioName.trim()) return;
              const res = await saveScenarioAction(profile.id, scenarioName, buildChanges());
              if (res?.error) {
                alert(res.error);
                return;
              }
              setScenarioName("");
              window.location.reload();
            }}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Сохранить
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {scenarios.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-border p-3">
              <span>{s.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadScenario(s)}
                  className="text-primary hover:underline"
                >
                  Загрузить
                </button>
                <button
                  onClick={() => setDeleteScenarioId(s.id)}
                  className="text-danger hover:underline"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {deleteScenarioId && (
        <ConfirmDeleteModal
          title="Удаление сценария"
          message="Удалить этот сценарий?"
          onConfirm={async () => {
            await deleteScenarioAction(deleteScenarioId);
            window.location.reload();
          }}
          onCancel={() => setDeleteScenarioId(null)}
        />
      )}
    </div>
  );
}

type ComparisonChartPoint = {
  date: string;
  dateShort: string;
  chartKey: string;
  sortKey: number;
  baselineBalance: number;
  scenarioBalance: number;
  baselinePositive: number | null;
  baselineNegative: number | null;
  scenarioPositive: number | null;
  scenarioNegative: number | null;
};

function insertZeroCrossings(
  data: ComparisonChartPoint[],
  getValue: (p: ComparisonChartPoint) => number,
  setZero: (p: ComparisonChartPoint, otherValue: number) => ComparisonChartPoint,
  getOtherValue: (p: ComparisonChartPoint) => number,
  lerpOther: (a: ComparisonChartPoint, b: ComparisonChartPoint, t: number) => number
): ComparisonChartPoint[] {
  const result: ComparisonChartPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i]);
    const a = data[i];
    const b = data[i + 1];
    const va = getValue(a);
    const vb = b ? getValue(b) : undefined;
    if (vb !== undefined && va > 0 && vb < 0) {
      const tVal = va / (va - vb);
      const dA = new Date(a.date + "T12:00:00").getTime();
      const dB = new Date(b.date + "T12:00:00").getTime();
      const midDate = new Date(dA + tVal * (dB - dA));
      const sortKey = midDate.getTime();
      const otherVal = b ? lerpOther(a, b, tVal) : getOtherValue(a);
      const insertDate = b.date;
      const insertDateShort = formatDateDdMmYyyy(insertDate);
      result.push(setZero({ ...a, date: insertDate, dateShort: insertDateShort, chartKey: String(sortKey), sortKey }, otherVal));
    } else if (vb !== undefined && va < 0 && vb > 0) {
      const tVal = va / (va - vb);
      const dA = new Date(a.date + "T12:00:00").getTime();
      const dB = new Date(b.date + "T12:00:00").getTime();
      const midDate = new Date(dA + tVal * (dB - dA));
      const sortKey = midDate.getTime();
      const otherVal = b ? lerpOther(a, b, tVal) : getOtherValue(a);
      const insertDate = b.date;
      const insertDateShort = formatDateDdMmYyyy(insertDate);
      result.push(setZero({ ...a, date: insertDate, dateShort: insertDateShort, chartKey: String(sortKey), sortKey }, otherVal));
    }
  }
  return result;
}

function WhatIfComparisonChart({
  baseline,
  scenario,
  currency,
}: {
  baseline: ForecastDay[];
  scenario: ForecastDay[];
  currency: string;
}) {
  const baseData: ComparisonChartPoint[] = baseline.map((b, i) => {
    const s = scenario[i];
    const baseBal = Math.round(b.balance);
    const scenBal = s ? Math.round(s.balance) : 0;
    const sortKey = new Date(b.date + "T12:00:00").getTime();
    return {
      date: b.date,
      dateShort: formatDateDdMmYyyy(b.date),
      chartKey: b.date,
      sortKey,
      baselineBalance: baseBal,
      scenarioBalance: scenBal,
      baselinePositive: baseBal >= 0 ? baseBal : null,
      baselineNegative: baseBal <= 0 ? baseBal : null,
      scenarioPositive: scenBal >= 0 ? scenBal : null,
      scenarioNegative: scenBal <= 0 ? scenBal : null,
    };
  });

  let chartData = insertZeroCrossings(
    baseData,
    (p) => p.baselineBalance,
    (p, other) => ({
      ...p,
      baselineBalance: 0,
      scenarioBalance: other,
      baselinePositive: 0,
      baselineNegative: 0,
      scenarioPositive: other >= 0 ? other : null,
      scenarioNegative: other <= 0 ? other : null,
    }),
    (p) => p.scenarioBalance,
    (a, b, t) => (a.scenarioBalance ?? 0) + t * ((b.scenarioBalance ?? 0) - (a.scenarioBalance ?? 0))
  );
  chartData = insertZeroCrossings(
    chartData,
    (p) => p.scenarioBalance,
    (p, other) => ({
      ...p,
      baselineBalance: other,
      scenarioBalance: 0,
      baselinePositive: other >= 0 ? other : null,
      baselineNegative: other <= 0 ? other : null,
      scenarioPositive: 0,
      scenarioNegative: 0,
    }),
    (p) => p.baselineBalance,
    (a, b, t) => (a.baselineBalance ?? 0) + t * ((b.baselineBalance ?? 0) - (a.baselineBalance ?? 0))
  );
  chartData = chartData.sort((x, y) => x.sortKey - y.sortKey);
  chartData = chartData.map((p, i) => ({ ...p, chartKey: String(i) }));

  const formatValue = (v: number) => Math.round(v).toLocaleString("ru") + " " + currency;
  const tooltipStyle = {
    backgroundColor: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  };

  const xTickFormatter = (idx: string) => {
    const i = Number(idx);
    const p = chartData[i];
    if (!p) return "";
    const prev = chartData[i - 1];
    if (prev && prev.date === p.date) return "";
    return p.dateShort;
  };

  return (
    <div className="h-80 min-h-[320px] min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="chartKey" stroke="var(--muted)" fontSize={11} tickFormatter={xTickFormatter} />
          <YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(v) => Math.round(v).toLocaleString("ru")} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as ComparisonChartPoint;
              const baseVal = p?.baselineBalance ?? 0;
              const scenVal = p?.scenarioBalance ?? 0;
              return (
                <div style={tooltipStyle} className="px-3 py-2">
                  <p className="font-medium">Дата: {p?.dateShort}</p>
                  <p style={{ color: baseVal >= 0 ? "var(--primary-dark)" : "var(--danger)" }}>Базовый: {formatValue(baseVal)}</p>
                  <p style={{ color: scenVal >= 0 ? "var(--primary)" : "var(--danger)" }}>Сценарий: {formatValue(scenVal)}</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="3 3" />
          <Legend />
          <Line type="monotone" dataKey="baselinePositive" name="Базовый" stroke="var(--primary-dark)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="baselineNegative" name="" stroke="var(--danger)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} legendType="none" />
          <Line type="monotone" dataKey="scenarioPositive" name="Сценарий" stroke="var(--primary)" strokeWidth={2} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="scenarioNegative" name="" stroke="var(--danger)" strokeWidth={2} dot={false} connectNulls={false} legendType="none" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AddExpenseForm({
  categories,
  onAdd,
  onCancel,
}: {
  categories: ExpenseCategory[];
  onAdd: (item: { name: string; amount: number; frequency: string; categoryId: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [categoryId, setCategoryId] = useState<string | "">(categories[0]?.id ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !amount || categoryId.trim() === "") return;
    onAdd({ name: name.trim(), amount: Number(amount), frequency, categoryId });
    setName("");
    setAmount("");
    setCategoryId(categories[0]?.id ?? "");
  };

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <input
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <input
        type="number"
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <select
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      >
        <option value="DAILY">Ежедневно</option>
        <option value="WEEKLY">Еженедельно</option>
        <option value="MONTHLY">Ежемесячно</option>
        <option value="QUARTERLY">Ежеквартально</option>
        <option value="YEARLY">Ежегодно</option>
      </select>
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="rounded bg-primary px-2 py-1 text-sm text-white">Добавить</button>
        <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
      </div>
    </div>
  );
}

function EditExpenseForm({
  item,
  categories,
  onSave,
  onCancel,
}: {
  item: { name: string; amount: number; frequency: string; categoryId: string };
  categories: ExpenseCategory[];
  onSave: (item: { name: string; amount: number; frequency: string; categoryId: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [frequency, setFrequency] = useState(item.frequency);
  const [categoryId, setCategoryId] = useState(item.categoryId);

  const handleSave = () => {
    if (!name.trim() || !amount || !categoryId) return;
    onSave({ name: name.trim(), amount: Number(amount), frequency, categoryId });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 w-24 sm:w-32 rounded border border-border px-2 py-1 text-sm" />
      <input type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 w-16 sm:w-20 rounded border border-border px-2 py-1 text-sm" />
      <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
        <option value="DAILY">Ежедневно</option>
        <option value="WEEKLY">Еженедельно</option>
        <option value="MONTHLY">Ежемесячно</option>
        <option value="QUARTERLY">Ежеквартально</option>
        <option value="YEARLY">Ежегодно</option>
      </select>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button onClick={handleSave} className="rounded bg-primary px-2 py-1 text-sm text-white">Сохранить</button>
      <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
    </div>
  );
}

function AddIncomeForm({
  categories,
  onAdd,
  onCancel,
}: {
  categories: IncomeCategory[];
  onAdd: (item: { name: string; amount: number; frequency: string; categoryId?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [categoryId, setCategoryId] = useState<string | "">(categories[0]?.id ?? "");

  const handleSubmit = () => {
    if (!name.trim() || !amount) return;
    onAdd({ name: name.trim(), amount: Number(amount), frequency, categoryId: categoryId || undefined });
    setName("");
    setAmount("");
    setCategoryId(categories[0]?.id ?? "");
  };

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <input
        placeholder="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <input
        type="number"
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <select
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      >
        <option value="DAILY">Ежедневно</option>
        <option value="WEEKLY">Еженедельно</option>
        <option value="MONTHLY">Ежемесячно</option>
        <option value="QUARTERLY">Ежеквартально</option>
        <option value="YEARLY">Ежегодно</option>
      </select>
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      >
        <option value="">—</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="rounded bg-primary px-2 py-1 text-sm text-white">Добавить</button>
        <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
      </div>
    </div>
  );
}

function EditIncomeForm({
  item,
  categories,
  onSave,
  onCancel,
}: {
  item: { name: string; amount: number; frequency: string; categoryId?: string };
  categories: IncomeCategory[];
  onSave: (item: { name: string; amount: number; frequency: string; categoryId?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount));
  const [frequency, setFrequency] = useState(item.frequency ?? "MONTHLY");
  const [categoryId, setCategoryId] = useState(item.categoryId ?? "");

  const handleSave = () => {
    if (!name.trim() || !amount) return;
    onSave({ name: name.trim(), amount: Number(amount), frequency, categoryId: categoryId || undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 w-24 sm:w-32 rounded border border-border px-2 py-1 text-sm" />
      <input type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 w-16 sm:w-20 rounded border border-border px-2 py-1 text-sm" />
      <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
        <option value="DAILY">Ежедневно</option>
        <option value="WEEKLY">Еженедельно</option>
        <option value="MONTHLY">Ежемесячно</option>
        <option value="QUARTERLY">Ежеквартально</option>
        <option value="YEARLY">Ежегодно</option>
      </select>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border border-border px-2 py-1 text-sm">
        <option value="">—</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button onClick={handleSave} className="rounded bg-primary px-2 py-1 text-sm text-white">Сохранить</button>
      <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
    </div>
  );
}

function AddManualForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: { date: string; type: "IN" | "OUT"; amount: number; description?: string }) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!date || !amount) return;
    onAdd({ date, type, amount: Number(amount), description: description || undefined });
    setAmount("");
    setDescription("");
  };

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as "IN" | "OUT")}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      >
        <option value="IN">Доход</option>
        <option value="OUT">Расход</option>
      </select>
      <input
        type="number"
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <input
        placeholder="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded border border-border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="rounded bg-primary px-2 py-1 text-sm text-white">Добавить</button>
        <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
      </div>
    </div>
  );
}

function EditManualForm({
  item,
  onSave,
  onCancel,
}: {
  item: { date: string; type: "IN" | "OUT"; amount: number; description?: string };
  onSave: (item: { date: string; type: "IN" | "OUT"; amount: number; description?: string }) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(item.date);
  const [type, setType] = useState<"IN" | "OUT">(item.type);
  const [amount, setAmount] = useState(String(item.amount));
  const [description, setDescription] = useState(item.description ?? "");

  const handleSave = () => {
    if (!date || !amount) return;
    onSave({ date, type, amount: Number(amount), description: description || undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-border px-2 py-1 text-sm" />
      <select value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")} className="rounded border border-border px-2 py-1 text-sm">
        <option value="IN">Доход</option>
        <option value="OUT">Расход</option>
      </select>
      <input type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 w-16 sm:w-20 rounded border border-border px-2 py-1 text-sm" />
      <input placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} className="min-w-0 w-20 sm:w-24 rounded border border-border px-2 py-1 text-sm" />
      <button onClick={handleSave} className="rounded bg-primary px-2 py-1 text-sm text-white">Сохранить</button>
      <button onClick={onCancel} className="rounded border border-border px-2 py-1 text-sm">Отмена</button>
    </div>
  );
}
