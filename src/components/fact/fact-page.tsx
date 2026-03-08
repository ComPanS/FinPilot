"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createManualTransaction,
  deleteManualTransaction,
  createOrUpdateMonthlyDataAction,
  deleteMonthlyDataAction,
} from "@/app/actions/cashflow";
import { ActualDataModal } from "./actual-data-modal";
import { FactChart } from "./fact-chart-dynamic";
import { HistoryModal } from "@/components/cashflow/history-modal-dynamic";
import { EditModal } from "@/components/cashflow/edit-modal";
import { EditMonthlyModal } from "@/components/cashflow/edit-monthly-modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { parseCashFlowTextAction } from "@/app/actions/ai-cashflow";
import { parseExcelAndImportAction } from "@/app/actions/excel-import";
import { emitTourAction } from "@/components/tour/useTourAction";
import { TOUR_SWITCH_TAB_EVENT } from "@/lib/tour/steps";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { formatDateToDdMmYyyy } from "@/lib/date-utils";
import type { ForecastDayFact } from "@/types";
import type { Prisma } from "@prisma/client";

const MAX_EXCEL_SIZE = 5 * 1024 * 1024; // 5 MB

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type Profile = Prisma.CashFlowProfileGetPayload<{
  include: {
    regularExpenses: { include: { category: true } };
    regularIncomes: { include: { category: true } };
    manualTransactions: { include: { expenseCategory: true; incomeCategory: true } };
    monthlyData: true;
  };
}>;

type Category = { id: string; name: string; slug: string };

const manualSchema = z.object({
  date: z.string(),
  type: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive(),
  taxes: z.coerce.number().min(0).max(100).optional(),
  description: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  incomeCategoryId: z.string().optional(),
});

const monthlySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Формат YYYY-MM"),
  income: z.coerce.number().min(0),
  expense: z.coerce.number().min(0),
});

export function FactPage({
  profile,
  currency,
  profileId,
  userId: _userId,
  expenseCategories,
  incomeCategories,
  forecastFactOnly = [],
  zoneGreenMin = 50000,
  zoneRedMax = -50000,
}: {
  profile: Profile;
  currency: string;
  profileId: string;
  userId: string;
  expenseCategories: Category[];
  incomeCategories: Category[];
  forecastFactOnly?: ForecastDayFact[];
  zoneGreenMin?: number;
  zoneRedMax?: number;
}) {
  const [activeTab, setActiveTab] = useState<
    "expenses" | "incomes" | "manual" | "months" | "chart"
  >("expenses");
  const [actualModal, setActualModal] = useState<{
    entityType: "EXPENSE" | "INCOME";
    entity: (typeof profile.regularExpenses)[0] | (typeof profile.regularIncomes)[0];
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    entityType: "MANUAL";
    entity: (typeof profile.manualTransactions)[0];
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<{
    entityId: string;
    entityType: string;
  } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [editMonthlyModal, setEditMonthlyModal] = useState<{ month: string; income: number; expense: number } | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const excelInputRefMonths = useRef<HTMLInputElement>(null);
  const router = useRouter();

  type ManualSortKey = "date" | "type" | "amount" | "description" | "createdAt" | "updatedAt";
  const [manualSort, setManualSort] = useState<{ key: ManualSortKey; dir: "asc" | "desc" }>({ key: "updatedAt", dir: "desc" });

  const firstExpenseCat = expenseCategories.find((c) => c.slug !== "custom");
  const firstIncomeCat = incomeCategories.find((c) => c.slug !== "custom");

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (tab === "expenses" || tab === "incomes" || tab === "manual" || tab === "months") {
        setActiveTab(tab);
      }
    };
    document.addEventListener(TOUR_SWITCH_TAB_EVENT, handler, true);
    return () => document.removeEventListener(TOUR_SWITCH_TAB_EVENT, handler, true);
  }, []);

  const toggleManualSort = (key: ManualSortKey) =>
    setManualSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  const sortManual = (arr: typeof profile.manualTransactions) =>
    [...arr].sort((a, b) => {
      const mult = manualSort.dir === "asc" ? 1 : -1;
      switch (manualSort.key) {
        case "date":
          return mult * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case "type":
          return mult * (a.type.localeCompare(b.type) || 0);
        case "amount":
          return mult * (Number(a.amount) - Number(b.amount));
        case "description":
          return mult * ((a.description ?? "").localeCompare(b.description ?? "") || 0);
        case "createdAt":
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case "updatedAt":
        default:
          return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      }
    });

  const manualForm = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: "OUT",
      taxes: 0,
      expenseCategoryId: firstExpenseCat?.id ?? "",
      incomeCategoryId: firstIncomeCat?.id ?? "",
    },
  });

  const manualType = useWatch({ name: "type", control: manualForm.control });

  const monthlyForm = useForm<z.infer<typeof monthlySchema>>({
    resolver: zodResolver(monthlySchema),
    defaultValues: {
      month: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })(),
      income: 0,
      expense: 0,
    },
  });

  const onAddManual = manualForm.handleSubmit(async (data) => {
    const manualRes = await createManualTransaction({
      profileId: profile.id,
      date: new Date(data.date),
      type: data.type as "IN" | "OUT",
      amount: data.amount,
      taxes: data.taxes ?? 0,
      description: data.description,
      expenseCategoryId: data.type === "OUT" ? (data.expenseCategoryId || undefined) : undefined,
      incomeCategoryId: data.type === "IN" ? (data.incomeCategoryId || undefined) : undefined,
    });
    if (!manualRes?.error) emitTourAction("add_manual");
    manualForm.reset({
      date: new Date().toISOString().slice(0, 10),
      type: "OUT",
      taxes: 0,
      expenseCategoryId: firstExpenseCat?.id ?? "",
    });
    router.refresh();
  });

  const onAddMonthly = monthlyForm.handleSubmit(async (data) => {
    const res = await createOrUpdateMonthlyDataAction(profile.id, data.month, data.income, data.expense);
    if (res?.error) {
      alert(res.error);
      return;
    }
    emitTourAction("add_monthly");
    monthlyForm.reset({
      month: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })(),
      income: 0,
      expense: 0,
    });
    router.refresh();
  });

  const onAiTextSubmit = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    const res = await parseCashFlowTextAction(profile.id, aiText, expenseCategories, incomeCategories);
    setAiLoading(false);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setAiText("");
    router.refresh();
  };

  const handleExcelImport = async (inputRef: React.RefObject<HTMLInputElement | null>) => {
    const input = inputRef.current;
    if (!input?.files?.length) return;
    const file = input.files[0];
    if (file.size > MAX_EXCEL_SIZE) {
      alert("Файл слишком большой (максимум 5 МБ)");
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "xlsx" && ext !== "xls") {
      alert("Поддерживаются только .xlsx и .xls");
      return;
    }
    setExcelLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      const result = await parseExcelAndImportAction(profile.id, base64);
      setExcelLoading(false);
      input.value = "";
      if (result?.error) {
        alert(result.error);
        return;
      }
      if (result?.success) {
        if (result.partialErrors?.length) {
          alert(`Импортировано: ${result.created}. Ошибки: ${result.partialErrors.join("; ")}`);
        }
        router.refresh();
      }
    } catch (e) {
      setExcelLoading(false);
      input.value = "";
      alert(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  };

  const freqLabel = (f: string, customDays?: number | null) =>
    f === "MONTHLY" ? "Ежемесячно"
    : f === "QUARTERLY" ? "Ежеквартально"
    : f === "YEARLY" ? "Раз в год"
    : f === "WEEKLY" ? "Еженедельно"
    : f === "DAILY" ? "Ежедневно"
    : f === "CUSTOM" && customDays ? `Каждые ${customDays} дн.`
    : "Кастомный";

  const incomeFreqLabel = (f: string, customDays?: number | null) =>
    f === "MONTHLY" ? "Ежемесячно"
    : f === "QUARTERLY" ? "Ежеквартально"
    : f === "YEARLY" ? "Раз в год"
    : f === "WEEKLY" ? "Еженедельно"
    : f === "DAILY" ? "Ежедневно"
    : f === "CUSTOM" && customDays ? `Каждые ${customDays} дн.`
    : "Кастомный";

  const onSuccess = () => {
    emitTourAction("add_fact_data");
    router.refresh();
  };

  const tabs = [
    { id: "expenses" as const, label: "Регулярные расходы" },
    { id: "incomes" as const, label: "Доходы" },
    { id: "manual" as const, label: "Разовые" },
    { id: "months" as const, label: "Данные по месяцам" },
    { id: "chart" as const, label: "График" },
  ];

  const manualTransactions = profile.manualTransactions ?? [];
  const monthlyData = profile.monthlyData ?? [];

  return (
    <div className="space-y-6">
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={() => handleExcelImport(excelInputRef)}
      />
      <input
        ref={excelInputRefMonths}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={() => handleExcelImport(excelInputRefMonths)}
      />
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <label className="block text-sm font-medium">Добавить текстом (ИИ обработает)</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Например: «аренда 50000 ежемесячно», «продажи 100000 в марте», «в январе доход 100000 расход 80000»
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
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            disabled={excelLoading || aiLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary hover:bg-primary/10 disabled:opacity-50"
            title="Загрузить Excel"
          >
            {excelLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tour-id={t.id === "expenses" ? "tab-expenses" : t.id === "incomes" ? "tab-incomes" : t.id === "manual" ? "tab-manual" : t.id === "months" ? "tab-months" : undefined}
            onClick={() => {
              setActiveTab(t.id);
              setEditModal(null);
            }}
            className={`cursor-pointer border-b-2 px-4 py-2 font-medium ${
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Название</th>
                <th className="p-2 text-left">Сумма</th>
                <th className="p-2 text-left">Частота</th>
                <th className="p-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {profile.regularExpenses.map((e, i) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{Number(e.amount)} {currency}</td>
                  <td className="p-2">{freqLabel(e.frequency, e.customDays)}</td>
                  <td className="p-2">
                    <button
                      data-tour-id={i === 0 ? "btn-actual-data" : undefined}
                      onClick={() => setActualModal({ entityType: "EXPENSE", entity: e })}
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Фактические данные
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profile.regularExpenses.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Нет регулярных расходов. Добавьте их в планировщике.
            </p>
          )}
        </div>
      )}

      {activeTab === "incomes" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Название</th>
                <th className="p-2 text-left">Сумма</th>
                <th className="p-2 text-left">Частота</th>
                <th className="p-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {profile.regularIncomes.map((i, idx) => (
                <tr key={i.id} className="border-b border-border">
                  <td className="p-2">{i.name}</td>
                  <td className="p-2">{Number(i.amount ?? i.avgCheck ?? 0)} {currency}</td>
                  <td className="p-2">{incomeFreqLabel(i.frequency ?? "MONTHLY", i.customDays)}</td>
                  <td className="p-2">
                    <button
                      data-tour-id={profile.regularExpenses.length === 0 && idx === 0 ? "btn-actual-data" : undefined}
                      onClick={() => setActualModal({ entityType: "INCOME", entity: i })}
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Фактические данные
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profile.regularIncomes.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Нет регулярных доходов. Добавьте их в планировщике.
            </p>
          )}
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-4">
          <form onSubmit={onAddManual} data-tour-id="form-add-manual" className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Дата</label>
              <input {...manualForm.register("date")} type="date" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Тип</label>
              <select
                {...manualForm.register("type", {
                  onChange: () => {
                    manualForm.setValue("expenseCategoryId", expenseCategories.find((c) => c.slug !== "custom")?.id ?? "");
                    manualForm.setValue("incomeCategoryId", incomeCategories.find((c) => c.slug !== "custom")?.id ?? "");
                  },
                })}
                className="rounded border border-border bg-background px-2 py-1 text-foreground"
              >
                <option value="IN">Поступление</option>
                <option value="OUT">Расход</option>
              </select>
            </div>
            {manualType === "OUT" ? (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
                <select {...manualForm.register("expenseCategoryId")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                  {expenseCategories.filter((c) => c.slug !== "custom").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="">Без категории</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
                <select {...manualForm.register("incomeCategoryId")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                  {incomeCategories.filter((c) => c.slug !== "custom").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="">Без категории</option>
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма (₽)</label>
              <input {...manualForm.register("amount")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Налоги (%)</label>
              <input {...manualForm.register("taxes")} type="number" min={0} max={100} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Описание</label>
              <input {...manualForm.register("description")} placeholder="Например: Покупка оборудования" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleManualSort("date")}>Дата {manualSort.key === "date" && (manualSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleManualSort("type")}>Тип {manualSort.key === "type" && (manualSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="p-2 text-left">Категория</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleManualSort("amount")}>Сумма {manualSort.key === "amount" && (manualSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleManualSort("description")}>Описание {manualSort.key === "description" && (manualSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleManualSort("createdAt")}>Создан {manualSort.key === "createdAt" && (manualSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortManual(manualTransactions).map((t) => {
                  const txDate = new Date(t.date);
                  const firstOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  const isOverdue = txDate < firstOfCurrentMonth;
                  return (
                  <tr key={t.id} className={`border-b border-border ${isOverdue ? "text-muted-foreground" : ""}`}>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(t.date))}</td>
                    <td className="p-2">{t.type === "IN" ? "+" : "-"}</td>
                    <td className="p-2">{(t as { expenseCategory?: { name: string }; incomeCategory?: { name: string } }).expenseCategory?.name ?? (t as { incomeCategory?: { name: string } }).incomeCategory?.name ?? "-"}</td>
                    <td className="p-2">{Number(t.amount)} {currency}</td>
                    <td className="p-2">{t.description ?? "-"}</td>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(t.createdAt))}</td>
                    <td className="p-2">
                      <button onClick={() => setEditModal({ entityType: "MANUAL", entity: t })} className="cursor-pointer text-primary hover:underline mr-2">Изменить</button>
                      <button onClick={() => setHistoryModal({ entityId: t.id, entityType: "MANUAL" })} className="cursor-pointer text-muted-foreground hover:underline mr-2">История</button>
                      <button
                        onClick={() =>
                          setDeleteConfirmModal({
                            message: "Удалить эту операцию?",
                            onConfirm: async () => {
                              await deleteManualTransaction(t.id);
                              router.refresh();
                            },
                          })
                        }
                        className="cursor-pointer text-danger hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "months" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm text-foreground">
              Не рекомендуется использовать такое заполнение, так как оно имеет слишком мало данных для предсказуемых результатов. Стоит использовать лишь когда нет возможности заполнения по дням.
            </p>
          </div>
          <form onSubmit={onAddMonthly} data-tour-id="form-add-monthly" className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Месяц</label>
              <input
                {...monthlyForm.register("month")}
                type="month"
                max={(() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 1);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                })()}
                className="rounded border border-border bg-background px-2 py-1 text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Доход ({currency})</label>
              <input {...monthlyForm.register("income")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-28 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Расход ({currency})</label>
              <input {...monthlyForm.register("expense")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-28 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <button type="submit" className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
              Добавить
            </button>
            <button
              type="button"
              onClick={() => excelInputRefMonths.current?.click()}
              disabled={excelLoading}
              className="flex h-9 w-9 items-center justify-center rounded border border-border text-primary hover:bg-surface disabled:opacity-50"
              title="Загрузить Excel"
            >
              {excelLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Месяц</th>
                  <th className="p-2 text-right">Доход</th>
                  <th className="p-2 text-right">Расход</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.sort((a, b) => a.month.localeCompare(b.month)).map((m) => {
                  const [y, mo] = m.month.split("-").map(Number);
                  const label = `${monthNames[mo - 1]} ${y}`;
                  return (
                    <tr key={m.month} className="border-b border-border">
                      <td className="p-2">{label}</td>
                      <td className="p-2 text-right">{Number(m.income).toLocaleString("ru")} {currency}</td>
                      <td className="p-2 text-right">{Number(m.expense).toLocaleString("ru")} {currency}</td>
                      <td className="p-2">
                        <button
                          onClick={() => setEditMonthlyModal({ month: m.month, income: Number(m.income), expense: Number(m.expense) })}
                          className="cursor-pointer text-primary hover:underline"
                        >
                          Изменить
                        </button>
                        {" · "}
                        <button
                          onClick={() =>
                            setDeleteConfirmModal({
                              message: `Удалить данные за ${label}?`,
                              onConfirm: async () => {
                                await deleteMonthlyDataAction(profile.id, m.month);
                                setEditMonthlyModal((prev) => (prev?.month === m.month ? null : prev));
                                router.refresh();
                              },
                            })
                          }
                          className="cursor-pointer text-danger hover:underline"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {monthlyData.length === 0 && (
            <p className="text-sm text-muted-foreground">Нет данных по месяцам. Добавьте вручную или используйте общий инпут выше.</p>
          )}
        </div>
      )}

      {activeTab === "chart" && (
        <div className="space-y-4">
          <FactChart
            data={forecastFactOnly}
            currency={currency}
            zoneGreenMin={zoneGreenMin}
            zoneRedMax={zoneRedMax}
          />
        </div>
      )}

      {actualModal && (
        <ActualDataModal
          entityType={actualModal.entityType}
          entity={actualModal.entity}
          currency={currency}
          profileId={profileId}
          onClose={() => setActualModal(null)}
          onSuccess={onSuccess}
        />
      )}

      {historyModal && (
        <HistoryModal
          profileId={profile.id}
          entityId={historyModal.entityId}
          entityType={historyModal.entityType}
          currency={currency}
          zoneGreenMin={zoneGreenMin}
          zoneRedMax={zoneRedMax}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {editModal && (
        <EditModal
          entityType={editModal.entityType}
          entity={editModal.entity}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          currency={currency}
          onClose={() => setEditModal(null)}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {editMonthlyModal && (
        <EditMonthlyModal
          month={editMonthlyModal.month}
          income={editMonthlyModal.income}
          expense={editMonthlyModal.expense}
          currency={currency}
          onSave={async (income, expense) => {
            const res = await createOrUpdateMonthlyDataAction(profile.id, editMonthlyModal.month, income, expense);
            if (res?.error) {
              alert(res.error);
              return false;
            }
            router.refresh();
            return true;
          }}
          onClose={() => setEditMonthlyModal(null)}
        />
      )}

      {deleteConfirmModal && (
        <ConfirmDeleteModal
          message={deleteConfirmModal.message}
          onConfirm={deleteConfirmModal.onConfirm}
          onCancel={() => setDeleteConfirmModal(null)}
        />
      )}
    </div>
  );
}
