"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  createCategory,
  createIncomeCategory,
  createOrUpdateMonthlyDataAction,
  deleteMonthlyDataAction,
} from "@/app/actions/cashflow";
import { getForecastAction } from "@/app/actions/forecast";
import { getRedZones } from "@/lib/services/forecast";
import { ForecastChart } from "./forecast-chart";
import { HistoryModal } from "./history-modal";
import { EditModal } from "./edit-modal";
import { EditMonthlyModal } from "./edit-monthly-modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { ExpectedPeriodsModal } from "./expected-periods-modal";
import { parseCashFlowTextAction } from "@/app/actions/ai-cashflow";
import { parseExcelAndImportAction } from "@/app/actions/excel-import";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { formatDateDdMmYyyy, formatDateToDdMmYyyy } from "@/lib/date-utils";
import type { Prisma } from "@prisma/client";

type Profile = Prisma.CashFlowProfileGetPayload<{
  include: {
    regularExpenses: { include: { category: true } };
    regularIncomes: true;
    manualTransactions: true;
    monthlyData: true;
  };
}>;
type Category = { id: string; name: string; slug: string };

const MAX_EXCEL_SIZE = 5 * 1024 * 1024; // 5 MB

const expenseSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY", "CUSTOM"]),
  categoryId: z.string(),
  customDays: z.coerce.number().positive().optional(),
});

const incomeSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  taxes: z.coerce.number().min(0).max(100).optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY", "CUSTOM"]),
  categoryId: z.string().optional(),
  customDays: z.coerce.number().positive().optional(),
});

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

const CUSTOM_CATEGORY_VALUE = "__custom__";

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

export function CashFlowPlanner({
  profile,
  expenseCategories,
  incomeCategories,
  forecastDays,
  userId,
}: {
  profile: Profile;
  expenseCategories: Category[];
  incomeCategories: Category[];
  forecastDays: number;
  userId: string;
}) {
  const [activeTab, setActiveTab] = useState<
    "expenses" | "incomes" | "manual" | "months" | "chart"
  >("expenses");
  const [forecast, setForecast] = useState<{
    forecast: { date: string; balance: number; inflows: number; outflows: number }[];
    zoneGreenMin: number;
    zoneRedMax: number;
    usedPatterns?: boolean;
    hasEnoughPatternData?: boolean;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    entityType: "EXPENSE" | "INCOME" | "MANUAL";
    entity: (typeof profile.regularExpenses)[0] | (typeof profile.regularIncomes)[0] | (typeof profile.manualTransactions)[0];
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<{
    entityId: string;
    entityType: string;
  } | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [expectedPeriodsModal, setExpectedPeriodsModal] = useState<{
    entityType: "EXPENSE" | "INCOME";
    entity?: (typeof profile.regularExpenses)[0] | (typeof profile.regularIncomes)[0];
    addMode?: boolean;
    initialData?: Record<string, number>;
  } | null>(null);
  const [addFormExpectedData, setAddFormExpectedData] = useState<{ entityType: "EXPENSE" | "INCOME"; data: Record<string, number> } | null>(null);
  const [editMonthlyModal, setEditMonthlyModal] = useState<{ month: string; income: number; expense: number } | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const excelInputRefMonths = useRef<HTMLInputElement>(null);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customIncomeCategoryName, setCustomIncomeCategoryName] = useState("");
  const router = useRouter();

  type ExpenseSortKey = "name" | "amount" | "frequency" | "createdAt" | "updatedAt";
  type IncomeSortKey = "name" | "amount" | "frequency" | "createdAt" | "updatedAt";
  type ManualSortKey = "date" | "type" | "amount" | "description" | "createdAt" | "updatedAt";
  const [expenseSort, setExpenseSort] = useState<{ key: ExpenseSortKey; dir: "asc" | "desc" }>({ key: "updatedAt", dir: "desc" });
  const [incomeSort, setIncomeSort] = useState<{ key: IncomeSortKey; dir: "asc" | "desc" }>({ key: "updatedAt", dir: "desc" });
  const [manualSort, setManualSort] = useState<{ key: ManualSortKey; dir: "asc" | "desc" }>({ key: "updatedAt", dir: "desc" });

  const toggleExpenseSort = (key: ExpenseSortKey) =>
    setExpenseSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  const toggleIncomeSort = (key: IncomeSortKey) =>
    setIncomeSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  const toggleManualSort = (key: ManualSortKey) =>
    setManualSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  const sortExpenses = (arr: typeof profile.regularExpenses) =>
    [...arr].sort((a, b) => {
      const mult = expenseSort.dir === "asc" ? 1 : -1;
      switch (expenseSort.key) {
        case "name":
          return mult * (a.name.localeCompare(b.name) || 0);
        case "amount":
          return mult * (Number(a.amount) - Number(b.amount));
        case "frequency":
          return mult * (a.frequency.localeCompare(b.frequency) || 0);
        case "createdAt":
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case "updatedAt":
        default:
          return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      }
    });

  const sortIncomes = (arr: typeof profile.regularIncomes) =>
    [...arr].sort((a, b) => {
      const mult = incomeSort.dir === "asc" ? 1 : -1;
      switch (incomeSort.key) {
        case "name":
          return mult * (a.name.localeCompare(b.name) || 0);
        case "amount":
          return mult * (Number(a.amount ?? a.avgCheck ?? 0) - Number(b.amount ?? b.avgCheck ?? 0));
        case "frequency":
          return mult * ((a.frequency ?? "").localeCompare(b.frequency ?? "") || 0);
        case "createdAt":
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case "updatedAt":
        default:
          return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      }
    });

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

  const zoneGreenMin = profile.zoneGreenMin ?? 50000;
  const zoneRedMax = profile.zoneRedMax ?? -50000;

  const loadForecast = async () => {
    const res = await getForecastAction(profile.id, { days: forecastDays, useExpectedData: true });
    if (res?.forecast) {
      setForecast({
        forecast: res.forecast,
        zoneGreenMin: res.zoneGreenMin ?? zoneGreenMin,
        zoneRedMax: res.zoneRedMax ?? zoneRedMax,
        usedPatterns: res.usedPatterns,
        hasEnoughPatternData: res.hasEnoughPatternData,
      });
      await saveForecastSnapshotAction(profile.id, res.forecast);
    }
  };

  const firstExpenseCat = expenseCategories.find((c) => c.slug !== "custom");
  const firstIncomeCat = incomeCategories.find((c) => c.slug !== "custom");

  const expenseForm = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      frequency: "MONTHLY",
      categoryId: firstExpenseCat?.id ?? "",
    },
  });

  const incomeForm = useForm<z.infer<typeof incomeSchema>>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      taxes: 0,
      frequency: "MONTHLY",
      categoryId: firstIncomeCat?.id ?? "",
    },
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

  const onAddExpense = expenseForm.handleSubmit(async (data) => {
    if (data.frequency === "CUSTOM" && (!data.customDays || data.customDays < 1)) {
      alert("Укажите количество дней для кастомной частоты");
      return;
    }
    let categoryId = data.categoryId;
    if (categoryId === CUSTOM_CATEGORY_VALUE) {
      if (!customCategoryName.trim()) {
        alert("Введите название своей категории");
        return;
      }
      const res = await createCategory({ userId, name: customCategoryName.trim() });
      if (res?.error) {
        alert(res.error);
        return;
      }
      categoryId = res.category!.id;
    }
    const expectedData = addFormExpectedData?.entityType === "EXPENSE" ? addFormExpectedData.data : undefined;
    await createExpense({
      profileId: profile.id,
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId,
      customDays: data.frequency === "CUSTOM" ? data.customDays : undefined,
      expectedData: expectedData && Object.keys(expectedData).length > 0 ? expectedData : undefined,
    });
    expenseForm.reset();
    setCustomCategoryName("");
    setAddFormExpectedData(null);
    loadForecast();
    if (categoryId !== data.categoryId) router.refresh();
  });

  const onAddIncome = incomeForm.handleSubmit(async (data) => {
    if (data.frequency === "CUSTOM" && (!data.customDays || data.customDays < 1)) {
      alert("Укажите количество дней для кастомной частоты");
      return;
    }
    let categoryId = data.categoryId;
    if (categoryId === CUSTOM_CATEGORY_VALUE) {
      if (!customIncomeCategoryName.trim()) {
        alert("Введите название своей категории");
        return;
      }
      const res = await createIncomeCategory({ userId, name: customIncomeCategoryName.trim() });
      if (res?.error) {
        alert(res.error);
        return;
      }
      categoryId = res.category!.id;
    }
    const expectedData = addFormExpectedData?.entityType === "INCOME" ? addFormExpectedData.data : undefined;
    await createIncome({
      profileId: profile.id,
      name: data.name,
      amount: data.amount,
      taxes: data.taxes ?? 0,
      frequency: data.frequency,
      categoryId: categoryId || undefined,
      customDays: data.frequency === "CUSTOM" ? data.customDays : undefined,
      expectedData: expectedData && Object.keys(expectedData).length > 0 ? expectedData : undefined,
    });
    incomeForm.reset();
    setCustomIncomeCategoryName("");
    setAddFormExpectedData(null);
    loadForecast();
    if (categoryId !== data.categoryId) router.refresh();
  });

  const onAddManual = manualForm.handleSubmit(async (data) => {
    await createManualTransaction({
      profileId: profile.id,
      date: new Date(data.date),
      type: data.type as "IN" | "OUT",
      amount: data.amount,
      taxes: data.taxes ?? 0,
      description: data.description,
      expenseCategoryId: data.type === "OUT" ? (data.expenseCategoryId || undefined) : undefined,
      incomeCategoryId: data.type === "IN" ? (data.incomeCategoryId || undefined) : undefined,
    });
    manualForm.reset({
      date: new Date().toISOString().slice(0, 10),
      type: "OUT",
      taxes: 0,
      expenseCategoryId: firstExpenseCat?.id ?? "",
    });
    loadForecast();
  });

  const onAddMonthly = monthlyForm.handleSubmit(async (data) => {
    const res = await createOrUpdateMonthlyDataAction(profile.id, data.month, data.income, data.expense);
    if (res?.error) {
      alert(res.error);
      return;
    }
    monthlyForm.reset({
      month: (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })(),
      income: 0,
      expense: 0,
    });
    loadForecast();
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
    loadForecast();
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
      console.log("[Excel Import] parseExcelAndImportAction result:", result);
      if (result?.debugJson) {
        console.log("[Excel Import] raw JSON (parse error):", result.debugJson);
      }
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
        loadForecast();
        router.refresh();
      }
    } catch (e) {
      setExcelLoading(false);
      input.value = "";
      alert(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  };

  const redZones = forecast ? getRedZones(forecast.forecast, zoneRedMax) : [];

  const tabs = [
    { id: "expenses" as const, label: "Регулярные расходы" },
    { id: "incomes" as const, label: "Доходы" },
    { id: "manual" as const, label: "Разовые" },
    { id: "months" as const, label: "Данные по месяцам" },
    { id: "chart" as const, label: "График" },
  ];

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
            onClick={() => {
              setActiveTab(t.id);
              setEditModal(null);
              if (t.id === "chart") loadForecast();
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
        <div className="space-y-4">
          <form onSubmit={onAddExpense} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...expenseForm.register("name")} placeholder="Например: Аренда" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма (₽)</label>
              <input {...expenseForm.register("amount")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Частота</label>
              <select {...expenseForm.register("frequency")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="MONTHLY">Ежемесячно</option>
                <option value="QUARTERLY">Ежеквартально</option>
                <option value="YEARLY">Раз в год</option>
                <option value="WEEKLY">Еженедельно</option>
                <option value="DAILY">Ежедневно</option>
                <option value="CUSTOM">Кастомный</option>
              </select>
            </div>
            {expenseForm.watch("frequency") === "CUSTOM" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Каждые (дней)</label>
                <input {...expenseForm.register("customDays")} type="number" min={1} placeholder="7" className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
              <select {...expenseForm.register("categoryId")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                {expenseCategories.filter((c) => c.slug !== "custom").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={CUSTOM_CATEGORY_VALUE}>Своя категория</option>
              </select>
            </div>
            {expenseForm.watch("categoryId") === CUSTOM_CATEGORY_VALUE && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Название своей категории</label>
                <input
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  placeholder="Введите название..."
                  className="rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setExpectedPeriodsModal({ entityType: "EXPENSE", addMode: true, initialData: addFormExpectedData?.entityType === "EXPENSE" ? addFormExpectedData.data : undefined })}
              className="rounded border border-border px-4 py-1 text-muted-foreground hover:bg-surface"
            >
              Ожидаемые данные
            </button>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleExpenseSort("name")}>Название {expenseSort.key === "name" && (expenseSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleExpenseSort("amount")}>Сумма {expenseSort.key === "amount" && (expenseSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleExpenseSort("frequency")}>Частота {expenseSort.key === "frequency" && (expenseSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleExpenseSort("createdAt")}>Создан {expenseSort.key === "createdAt" && (expenseSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleExpenseSort("updatedAt")}>Изменён {expenseSort.key === "updatedAt" && (expenseSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortExpenses(profile.regularExpenses).map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="p-2">{e.name}</td>
                    <td className="p-2">{Number(e.amount)} {profile.currency}</td>
                    <td className="p-2">{freqLabel(e.frequency, e.customDays)}</td>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(e.createdAt))}</td>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(e.updatedAt))}</td>
                    <td className="p-2">
                      <button
                        onClick={() => setEditModal({ entityType: "EXPENSE", entity: e })}
                        className="cursor-pointer text-primary hover:underline mr-2"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => setHistoryModal({ entityId: e.id, entityType: "EXPENSE" })}
                        className="cursor-pointer text-muted-foreground hover:underline mr-2"
                      >
                        История
                      </button>
                      <button
                        onClick={() => setExpectedPeriodsModal({ entityType: "EXPENSE", entity: e })}
                        className="cursor-pointer text-muted-foreground hover:underline mr-2"
                      >
                        Ожидаемые данные
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirmModal({
                            message: "Удалить этот расход?",
                            onConfirm: async () => {
                              await deleteExpense(e.id);
                              loadForecast();
                            },
                          })
                        }
                        className="cursor-pointer text-danger hover:underline"
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
          <form onSubmit={onAddIncome} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...incomeForm.register("name")} placeholder="Например: Продажи" className="rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма (₽)</label>
              <input {...incomeForm.register("amount")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Налоги (%)</label>
              <input {...incomeForm.register("taxes")} type="number" min={0} max={100} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Частота</label>
              <select {...incomeForm.register("frequency")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="MONTHLY">Ежемесячно</option>
                <option value="QUARTERLY">Ежеквартально</option>
                <option value="YEARLY">Раз в год</option>
                <option value="WEEKLY">Еженедельно</option>
                <option value="DAILY">Ежедневно</option>
                <option value="CUSTOM">Кастомный</option>
              </select>
            </div>
            {incomeForm.watch("frequency") === "CUSTOM" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Каждые (дней)</label>
                <input {...incomeForm.register("customDays")} type="number" min={1} placeholder="7" className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
              <select {...incomeForm.register("categoryId")} className="rounded border border-border bg-background px-2 py-1 text-foreground">
                {incomeCategories.filter((c) => c.slug !== "custom").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={CUSTOM_CATEGORY_VALUE}>Своя категория</option>
                <option value="">Без категории</option>
              </select>
            </div>
            {incomeForm.watch("categoryId") === CUSTOM_CATEGORY_VALUE && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Название своей категории</label>
                <input
                  value={customIncomeCategoryName}
                  onChange={(e) => setCustomIncomeCategoryName(e.target.value)}
                  placeholder="Введите название..."
                  className="rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setExpectedPeriodsModal({ entityType: "INCOME", addMode: true, initialData: addFormExpectedData?.entityType === "INCOME" ? addFormExpectedData.data : undefined })}
              className="rounded border border-border px-4 py-1 text-muted-foreground hover:bg-surface"
            >
              Ожидаемые данные
            </button>
            <button type="submit" className="rounded bg-primary px-4 py-1 text-white hover:bg-primary-dark">
              Добавить
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleIncomeSort("name")}>Название {incomeSort.key === "name" && (incomeSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleIncomeSort("amount")}>Сумма {incomeSort.key === "amount" && (incomeSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleIncomeSort("frequency")}>Частота {incomeSort.key === "frequency" && (incomeSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleIncomeSort("createdAt")}>Создан {incomeSort.key === "createdAt" && (incomeSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="cursor-pointer p-2 text-left hover:bg-surface/50" onClick={() => toggleIncomeSort("updatedAt")}>Изменён {incomeSort.key === "updatedAt" && (incomeSort.dir === "desc" ? "↓" : "↑")}</th>
                  <th className="p-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortIncomes(profile.regularIncomes).map((i) => (
                  <tr key={i.id} className="border-b border-border">
                    <td className="p-2">{i.name}</td>
                    <td className="p-2">{Number(i.amount ?? i.avgCheck ?? 0)} {profile.currency}</td>
                    <td className="p-2">{incomeFreqLabel(i.frequency ?? "MONTHLY", i.customDays)}</td>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(i.createdAt))}</td>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(i.updatedAt))}</td>
                    <td className="p-2">
                      <button onClick={() => setEditModal({ entityType: "INCOME", entity: i })} className="cursor-pointer text-primary hover:underline mr-2">Изменить</button>
                      <button onClick={() => setHistoryModal({ entityId: i.id, entityType: "INCOME" })} className="cursor-pointer text-muted-foreground hover:underline mr-2">История</button>
                      <button onClick={() => setExpectedPeriodsModal({ entityType: "INCOME", entity: i })} className="cursor-pointer text-muted-foreground hover:underline mr-2">Ожидаемые данные</button>
                      <button
                        onClick={() =>
                          setDeleteConfirmModal({
                            message: "Удалить этот доход?",
                            onConfirm: async () => {
                              await deleteIncome(i.id);
                              loadForecast();
                            },
                          })
                        }
                        className="cursor-pointer text-danger hover:underline"
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

      {activeTab === "months" && (
        <div className="space-y-4">
          <form onSubmit={onAddMonthly} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
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
              <label className="mb-1 block text-xs text-muted-foreground">Доход ({profile.currency})</label>
              <input {...monthlyForm.register("income")} type="number" min={0} placeholder="0" onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }} className="w-28 rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Расход ({profile.currency})</label>
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
                {(profile.monthlyData ?? []).sort((a, b) => a.month.localeCompare(b.month)).map((m) => {
                  const [y, mo] = m.month.split("-").map(Number);
                  const label = `${monthNames[mo - 1]} ${y}`;
                  return (
                    <tr key={m.month} className="border-b border-border">
                      <td className="p-2">{label}</td>
                      <td className="p-2 text-right">{Number(m.income).toLocaleString("ru")} {profile.currency}</td>
                      <td className="p-2 text-right">{Number(m.expense).toLocaleString("ru")} {profile.currency}</td>
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
                                loadForecast();
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
          {(profile.monthlyData ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Нет данных по месяцам. Добавьте вручную или используйте общий инпут выше.</p>
          )}
        </div>
      )}

      {activeTab === "manual" && (
        <div className="space-y-4">
          <form onSubmit={onAddManual} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
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
            {manualForm.watch("type") === "OUT" ? (
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
                {sortManual(profile.manualTransactions).map((t) => {
                  const txDate = new Date(t.date);
                  const firstOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                  const isOverdue = txDate < firstOfCurrentMonth;
                  return (
                  <tr key={t.id} className={`border-b border-border ${isOverdue ? "text-muted-foreground" : ""}`}>
                    <td className="p-2">{formatDateToDdMmYyyy(new Date(t.date))}</td>
                    <td className="p-2">{t.type === "IN" ? "+" : "-"}</td>
                    <td className="p-2">{(t as { expenseCategory?: { name: string }; incomeCategory?: { name: string } }).expenseCategory?.name ?? (t as { incomeCategory?: { name: string } }).incomeCategory?.name ?? "-"}</td>
                    <td className="p-2">{Number(t.amount)} {profile.currency}</td>
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
                              loadForecast();
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
                usedPatterns={forecast.usedPatterns}
                hasEnoughPatternData={forecast.hasEnoughPatternData}
              />
              {redZones.length > 0 && (
                <div className="rounded-lg border border-danger bg-danger/10 p-4">
                  <h3 className="font-semibold text-danger">Дни до разрыва (красные зоны)</h3>
                  <ul className="mt-2 space-y-1">
                    {redZones.slice(0, 10).map((d) => (
                      <li key={d.date}>
                        {formatDateDdMmYyyy(d.date)} — баланс {d.balance.toLocaleString("ru")} {profile.currency}
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

      {editModal && (
        <EditModal
          entityType={editModal.entityType}
          entity={editModal.entity}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          currency={profile.currency}
          onClose={() => setEditModal(null)}
          onSuccess={() => {
            loadForecast();
            router.refresh();
          }}
        />
      )}

      {editMonthlyModal && (
        <EditMonthlyModal
          month={editMonthlyModal.month}
          income={editMonthlyModal.income}
          expense={editMonthlyModal.expense}
          currency={profile.currency}
          onSave={async (income, expense) => {
            const res = await createOrUpdateMonthlyDataAction(profile.id, editMonthlyModal.month, income, expense);
            if (res?.error) {
              alert(res.error);
              return false;
            }
            loadForecast();
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

      {expectedPeriodsModal && (
        <ExpectedPeriodsModal
          entityType={expectedPeriodsModal.entityType}
          profileId={profile.id}
          entity={expectedPeriodsModal.entity ? {
            ...expectedPeriodsModal.entity,
            expectedData: expectedPeriodsModal.entity.expectedData as Record<string, number> | null | undefined,
            seasonalMultiplier: expectedPeriodsModal.entity.seasonalMultiplier as Record<string, number> | null | undefined,
          } : undefined}
          currency={profile.currency}
          onClose={() => setExpectedPeriodsModal(null)}
          onSuccess={() => {
            loadForecast();
            router.refresh();
          }}
          addMode={expectedPeriodsModal.addMode}
          initialData={expectedPeriodsModal.initialData}
          onSaveForAdd={expectedPeriodsModal.addMode ? (data) => {
            setAddFormExpectedData({ entityType: expectedPeriodsModal.entityType, data });
            setExpectedPeriodsModal(null);
          } : undefined}
        />
      )}
    </div>
  );
}
