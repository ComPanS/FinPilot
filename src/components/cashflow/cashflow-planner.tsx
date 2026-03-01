"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createExpense,
  updateExpense,
  createIncome,
  updateIncome,
  createManualTransaction,
  updateManualTransaction,
  deleteExpense,
  deleteIncome,
  deleteManualTransaction,
  saveForecastSnapshotAction,
} from "@/app/actions/cashflow";
import { getForecastAction } from "@/app/actions/forecast";
import { getRedZones } from "@/lib/services/forecast";
import { ForecastChart } from "./forecast-chart";
import { HistoryModal } from "./history-modal";
import { parseCashFlowTextAction } from "@/app/actions/ai-cashflow";
import type { Prisma } from "@prisma/client";

type Profile = Prisma.CashFlowProfileGetPayload<{
  include: {
    regularExpenses: { include: { category: true } };
    regularIncomes: true;
    manualTransactions: true;
  };
}>;
type Category = { id: string; name: string; slug: string };

const expenseSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  categoryId: z.string(),
});

const incomeSchema = z.object({
  name: z.string().min(1),
  avgCheck: z.coerce.number().positive(),
  month1: z.coerce.number().min(0),
  month2: z.coerce.number().min(0),
  month3: z.coerce.number().min(0),
});

const manualSchema = z.object({
  date: z.string(),
  type: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});

export function CashFlowPlanner({
  profile,
  categories,
  forecastDays,
}: {
  profile: Profile;
  categories: Category[];
  forecastDays: number;
}) {
  const [activeTab, setActiveTab] = useState<
    "expenses" | "incomes" | "manual" | "chart"
  >("expenses");
  const [forecast, setForecast] = useState<{
    forecast: { date: string; balance: number; inflows: number; outflows: number }[];
    zoneGreenMin: number;
    zoneRedMax: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState<{
    entityId: string;
    entityType: string;
  } | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const zoneGreenMin = profile.zoneGreenMin ?? 50000;
  const zoneRedMax = profile.zoneRedMax ?? -50000;

  const loadForecast = async () => {
    const res = await getForecastAction(profile.id, { days: forecastDays });
    if (res?.forecast) {
      setForecast({
        forecast: res.forecast,
        zoneGreenMin: res.zoneGreenMin ?? zoneGreenMin,
        zoneRedMax: res.zoneRedMax ?? zoneRedMax,
      });
      await saveForecastSnapshotAction(profile.id, res.forecast);
    }
  };

  const expenseForm = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      frequency: "MONTHLY",
      categoryId: categories[0]?.id ?? "",
    },
  });

  const incomeForm = useForm<z.infer<typeof incomeSchema>>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      month1: "" as unknown as number,
      month2: "" as unknown as number,
      month3: "" as unknown as number,
    },
  });

  const manualForm = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: "OUT",
    },
  });

  const onAddExpense = expenseForm.handleSubmit(async (data) => {
    if (editingId) {
      await updateExpense(editingId, {
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        categoryId: data.categoryId,
      });
      setEditingId(null);
    } else {
      await createExpense({
        profileId: profile.id,
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        categoryId: data.categoryId,
      });
    }
    expenseForm.reset();
    loadForecast();
  });

  const onAddIncome = incomeForm.handleSubmit(async (data) => {
    const salesPlan: Record<string, number> = {};
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const m = ((now.getMonth() + i) % 12) + 1;
      salesPlan[String(m)] = [data.month1, data.month2, data.month3][i % 3] ?? data.month1;
    }
    if (editingId) {
      await updateIncome(editingId, {
        name: data.name,
        avgCheck: data.avgCheck,
        salesPlan,
      });
      setEditingId(null);
    } else {
      await createIncome({
        profileId: profile.id,
        name: data.name,
        avgCheck: data.avgCheck,
        salesPlan,
      });
    }
    incomeForm.reset();
    loadForecast();
  });

  const onAddManual = manualForm.handleSubmit(async (data) => {
    if (editingId) {
      await updateManualTransaction(editingId, {
        date: new Date(data.date),
        type: data.type as "IN" | "OUT",
        amount: data.amount,
        description: data.description,
      });
      setEditingId(null);
    } else {
      await createManualTransaction({
        profileId: profile.id,
        date: new Date(data.date),
        type: data.type as "IN" | "OUT",
        amount: data.amount,
        description: data.description,
      });
    }
    manualForm.reset({ date: new Date().toISOString().slice(0, 10), type: "OUT" });
    loadForecast();
  });

  const onAiTextSubmit = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    const res = await parseCashFlowTextAction(profile.id, aiText, categories);
    setAiLoading(false);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setAiText("");
    loadForecast();
    window.location.reload();
  };

  const redZones = forecast ? getRedZones(forecast.forecast, zoneRedMax) : [];

  const tabs = [
    { id: "expenses" as const, label: "Регулярные расходы" },
    { id: "incomes" as const, label: "Доходы" },
    { id: "manual" as const, label: "Разовые" },
    { id: "chart" as const, label: "График" },
  ];

  const freqLabel = (f: string) =>
    f === "MONTHLY" ? "Ежемесячно" : f === "QUARTERLY" ? "Ежеквартально" : "Раз в год";

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const now = new Date();
  const planMonth1 = monthNames[now.getMonth()];
  const planMonth2 = monthNames[(now.getMonth() + 1) % 12];
  const planMonth3 = monthNames[(now.getMonth() + 2) % 12];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <label className="block text-sm font-medium">Добавить текстом (ИИ обработает)</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Например: «аренда 50000 ежемесячно», «продажи 100000 в марте», «расход 15000 15.03»
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Введите текст..."
            className="flex-1 rounded border border-border px-3 py-2"
            disabled={aiLoading}
          />
          <button
            onClick={onAiTextSubmit}
            disabled={aiLoading || !aiText.trim()}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {aiLoading ? "..." : "Добавить"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setEditingId(null);
              if (t.id === "chart") loadForecast();
            }}
            className={`border-b-2 px-4 py-2 font-medium ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "expenses" && (
        <div className="space-y-4">
          <form key={`exp-${formResetKey}`} onSubmit={onAddExpense} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...expenseForm.register("name")} placeholder="Например: Аренда" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма (₽)</label>
              <input {...expenseForm.register("amount")} type="number" placeholder="0" className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Частота</label>
              <select {...expenseForm.register("frequency")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="MONTHLY">Ежемесячно</option>
                <option value="QUARTERLY">Ежеквартально</option>
                <option value="YEARLY">Раз в год</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
              <select {...expenseForm.register("categoryId")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormResetKey((k) => k + 1);
                }}
                className="rounded border px-2 py-1"
              >
                Отмена
              </button>
            )}
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Название</th>
                  <th className="p-2 text-left">Сумма</th>
                  <th className="p-2 text-left">Частота</th>
                  <th className="p-2 text-left">Создан</th>
                  <th className="p-2 text-left">Изменён</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {[...profile.regularExpenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="p-2">{e.name}</td>
                    <td className="p-2">{Number(e.amount)} {profile.currency}</td>
                    <td className="p-2">{freqLabel(e.frequency)}</td>
                    <td className="p-2">{new Date(e.createdAt).toLocaleDateString("ru")}</td>
                    <td className="p-2">{new Date(e.updatedAt).toLocaleDateString("ru")}</td>
                    <td className="p-2">
                      <button
                        onClick={() => {
                          setEditingId(e.id);
                          expenseForm.reset({
                            name: e.name,
                            amount: Number(e.amount),
                            frequency: e.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY",
                            categoryId: e.categoryId,
                          });
                        }}
                        className="text-primary hover:underline mr-2"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => setHistoryModal({ entityId: e.id, entityType: "EXPENSE" })}
                        className="text-muted-foreground hover:underline mr-2"
                      >
                        История
                      </button>
                      <button
                        onClick={async () => { await deleteExpense(e.id); loadForecast(); }}
                        className="text-danger hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "incomes" && (
        <div className="space-y-4">
          <form key={`inc-${formResetKey}`} onSubmit={onAddIncome} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...incomeForm.register("name")} placeholder="Например: Продажи" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Средний чек (₽)</label>
              <input {...incomeForm.register("avgCheck")} type="number" placeholder="0" className="w-28 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">План продаж по месяцам (₽)</label>
              <div className="flex gap-1">
                <input {...incomeForm.register("month1")} type="number" placeholder={planMonth1} title={`План на ${planMonth1}`} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
                <input {...incomeForm.register("month2")} type="number" placeholder={planMonth2} title={`План на ${planMonth2}`} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
                <input {...incomeForm.register("month3")} type="number" placeholder={planMonth3} title={`План на ${planMonth3}`} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
              </div>
            </div>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormResetKey((k) => k + 1);
                }}
                className="rounded border px-2 py-1"
              >
                Отмена
              </button>
            )}
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Название</th>
                  <th className="p-2 text-left">Средний чек</th>
                  <th className="p-2 text-left">Создан</th>
                  <th className="p-2 text-left">Изменён</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {[...profile.regularIncomes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((i) => (
                  <tr key={i.id} className="border-b border-border">
                    <td className="p-2">{i.name}</td>
                    <td className="p-2">{Number(i.avgCheck)} {profile.currency}</td>
                    <td className="p-2">{new Date(i.createdAt).toLocaleDateString("ru")}</td>
                    <td className="p-2">{new Date(i.updatedAt).toLocaleDateString("ru")}</td>
                    <td className="p-2">
                      <button onClick={() => { setEditingId(i.id); incomeForm.reset({ name: i.name, avgCheck: Number(i.avgCheck), month1: 0, month2: 0, month3: 0 }); }} className="text-primary hover:underline mr-2">Изменить</button>
                      <button onClick={() => setHistoryModal({ entityId: i.id, entityType: "INCOME" })} className="text-muted-foreground hover:underline mr-2">История</button>
                      <button onClick={async () => { await deleteIncome(i.id); loadForecast(); }} className="text-danger hover:underline">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-4">
          <form key={`man-${formResetKey}`} onSubmit={onAddManual} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Дата</label>
              <input {...manualForm.register("date")} type="date" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Тип</label>
              <select {...manualForm.register("type")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="IN">Поступление</option>
                <option value="OUT">Расход</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма (₽)</label>
              <input {...manualForm.register("amount")} type="number" placeholder="0" className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Описание</label>
              <input {...manualForm.register("description")} placeholder="Например: Покупка оборудования" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              {editingId ? "Сохранить" : "Добавить"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormResetKey((k) => k + 1);
                }}
                className="rounded border px-2 py-1"
              >
                Отмена
              </button>
            )}
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Дата</th>
                  <th className="p-2 text-left">Тип</th>
                  <th className="p-2 text-left">Сумма</th>
                  <th className="p-2 text-left">Описание</th>
                  <th className="p-2 text-left">Создан</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {[...profile.manualTransactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="p-2">{new Date(t.date).toLocaleDateString("ru")}</td>
                    <td className="p-2">{t.type === "IN" ? "+" : "-"}</td>
                    <td className="p-2">{Number(t.amount)} {profile.currency}</td>
                    <td className="p-2">{t.description ?? "-"}</td>
                    <td className="p-2">{new Date(t.createdAt).toLocaleDateString("ru")}</td>
                    <td className="p-2">
                      <button onClick={() => { setEditingId(t.id); manualForm.reset({ date: new Date(t.date).toISOString().slice(0, 10), type: t.type as "IN" | "OUT", amount: Number(t.amount), description: t.description ?? "" }); }} className="text-primary hover:underline mr-2">Изменить</button>
                      <button onClick={() => setHistoryModal({ entityId: t.id, entityType: "MANUAL" })} className="text-muted-foreground hover:underline mr-2">История</button>
                      <button onClick={async () => { await deleteManualTransaction(t.id); loadForecast(); }} className="text-danger hover:underline">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "chart" && (
        <div className="space-y-4">
          <button
            onClick={loadForecast}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Рассчитать прогноз
          </button>
          {forecast && (
            <>
              <ForecastChart
                data={forecast.forecast}
                zoneGreenMin={forecast.zoneGreenMin}
                zoneRedMax={forecast.zoneRedMax}
              />
              {redZones.length > 0 && (
                <div className="rounded-lg border border-danger bg-danger/10 p-4">
                  <h3 className="font-semibold text-danger">Дни до разрыва (красные зоны)</h3>
                  <ul className="mt-2 space-y-1">
                    {redZones.slice(0, 10).map((d) => (
                      <li key={d.date}>
                        {d.date} — баланс {d.balance.toLocaleString("ru")} {profile.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {historyModal && (
        <HistoryModal
          profileId={profile.id}
          entityId={historyModal.entityId}
          entityType={historyModal.entityType}
          currency={profile.currency}
          zoneGreenMin={zoneGreenMin}
          zoneRedMax={zoneRedMax}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
}
