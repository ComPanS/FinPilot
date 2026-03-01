"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createExpense,
  createIncome,
  createManualTransaction,
  deleteExpense,
  deleteIncome,
  deleteManualTransaction,
} from "@/app/actions/cashflow";
import { getForecastAction } from "@/app/actions/forecast";
import { getRedZones } from "@/lib/services/forecast";
import { ForecastChart } from "./forecast-chart";
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
  const [forecast, setForecast] = useState<{ date: string; balance: number; inflows: number; outflows: number }[] | null>(null);

  const loadForecast = async () => {
    const res = await getForecastAction(profile.id, { days: forecastDays });
    if (res?.forecast) setForecast(res.forecast);
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
      month1: 0,
      month2: 0,
      month3: 0,
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
    await createExpense({
      profileId: profile.id,
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId: data.categoryId,
    });
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
    await createIncome({
      profileId: profile.id,
      name: data.name,
      avgCheck: data.avgCheck,
      salesPlan,
    });
    incomeForm.reset();
    loadForecast();
  });

  const onAddManual = manualForm.handleSubmit(async (data) => {
    await createManualTransaction({
      profileId: profile.id,
      date: new Date(data.date),
      type: data.type as "IN" | "OUT",
      amount: data.amount,
      description: data.description,
    });
    manualForm.reset({ date: new Date().toISOString().slice(0, 10), type: "OUT" });
    loadForecast();
  });

  const redZones = forecast ? getRedZones(forecast) : [];

  const tabs = [
    { id: "expenses" as const, label: "Регулярные расходы" },
    { id: "incomes" as const, label: "Доходы" },
    { id: "manual" as const, label: "Разовые" },
    { id: "chart" as const, label: "График" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
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
          <form onSubmit={onAddExpense} className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
            <input
              {...expenseForm.register("name")}
              placeholder="Название"
              className="rounded border border-border px-2 py-1"
            />
            <input
              {...expenseForm.register("amount")}
              type="number"
              placeholder="Сумма"
              className="w-24 rounded border border-border px-2 py-1"
            />
            <select
              {...expenseForm.register("frequency")}
              className="rounded border border-border px-2 py-1"
            >
              <option value="MONTHLY">Ежемесячно</option>
              <option value="QUARTERLY">Ежеквартально</option>
              <option value="YEARLY">Раз в год</option>
            </select>
            <select
              {...expenseForm.register("categoryId")}
              className="rounded border border-border px-2 py-1"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}> {c.name}</option>
              ))}
            </select>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <ul className="space-y-2">
            {profile.regularExpenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded border border-border p-3">
                <span>{e.name} — {Number(e.amount)} {profile.currency} ({e.frequency})</span>
                <button
                  onClick={async () => {
                    await deleteExpense(e.id);
                    loadForecast();
                  }}
                  className="text-danger hover:underline"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "incomes" && (
        <div className="space-y-4">
          <form onSubmit={onAddIncome} className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
            <input
              {...incomeForm.register("name")}
              placeholder="Название"
              className="rounded border border-border px-2 py-1"
            />
            <input
              {...incomeForm.register("avgCheck")}
              type="number"
              placeholder="Средний чек"
              className="w-28 rounded border border-border px-2 py-1"
            />
            <input
              {...incomeForm.register("month1")}
              type="number"
              placeholder="Месяц 1"
              className="w-20 rounded border border-border px-2 py-1"
            />
            <input
              {...incomeForm.register("month2")}
              type="number"
              placeholder="Месяц 2"
              className="w-20 rounded border border-border px-2 py-1"
            />
            <input
              {...incomeForm.register("month3")}
              type="number"
              placeholder="Месяц 3"
              className="w-20 rounded border border-border px-2 py-1"
            />
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <ul className="space-y-2">
            {profile.regularIncomes.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded border border-border p-3">
                <span>{i.name} — {Number(i.avgCheck)} {profile.currency}</span>
                <button
                  onClick={async () => {
                    await deleteIncome(i.id);
                    loadForecast();
                  }}
                  className="text-danger hover:underline"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-4">
          <form onSubmit={onAddManual} className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
            <input
              {...manualForm.register("date")}
              type="date"
              className="rounded border border-border px-2 py-1"
            />
            <select
              {...manualForm.register("type")}
              className="rounded border border-border px-2 py-1"
            >
              <option value="IN">Поступление</option>
              <option value="OUT">Расход</option>
            </select>
            <input
              {...manualForm.register("amount")}
              type="number"
              placeholder="Сумма"
              className="w-24 rounded border border-border px-2 py-1"
            />
            <input
              {...manualForm.register("description")}
              placeholder="Описание"
              className="rounded border border-border px-2 py-1"
            />
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <ul className="space-y-2">
            {profile.manualTransactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border border-border p-3">
                <span>
                  {t.date.toLocaleDateString("ru")} — {t.type === "IN" ? "+" : "-"}
                  {Number(t.amount)} {t.description}
                </span>
                <button
                  onClick={async () => {
                    await deleteManualTransaction(t.id);
                    loadForecast();
                  }}
                  className="text-danger hover:underline"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
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
              <ForecastChart data={forecast} />
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
    </div>
  );
}
