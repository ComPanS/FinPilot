"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { askNeuro } from "@/lib/neuroapi";
import { createExpense, createIncome, createManualTransaction, createOrUpdateMonthlyDataAction } from "./cashflow";

type Category = { id: string; name: string; slug: string };

async function parseAndCreate(
  profileId: string,
  text: string,
  expenseCategories: Category[],
  incomeCategories: Category[]
): Promise<{ success: boolean; error?: string }> {
  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходе, расходе или данных по месяцу. Верни ТОЛЬКО один JSON объект без markdown:
{"type":"expense"|"income"|"manual"|"monthly","name":"название","amount":число,"frequency":"MONTHLY"|"QUARTERLY"|"YEARLY"|"WEEKLY"|"DAILY"|"CUSTOM"|null,"customDays":число|null,"date":"YYYY-MM-DD"|null,"description":строка|null,"manualType":"IN"|"OUT"|null,"month":"YYYY-MM"|null,"income":число|null,"expense":число|null}

- expense: регулярный расход — name, amount, frequency
- income: регулярный доход — name, amount, frequency
- manual: разовая операция — name или description, amount, manualType "IN" или "OUT", date в YYYY-MM-DD
- monthly: данные по месяцу (доход и расход за месяц, не привязаны к сущностям) — month в YYYY-MM, income (доход за месяц), expense (расход за месяц). Примеры: "В январе доход 100000 расход 80000", "Февраль: поступления 120000, расходы 90000"
- ВАЖНО: если указан только день и месяц — используй год ${currentYear}
- Для monthly: год ${currentYear} если не указан

Текст: "${text.trim()}"`;

  const response = await askNeuro(prompt, {});
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace >= 0) {
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }
  const parsed = JSON.parse(jsonStr) as {
    type: "expense" | "income" | "manual" | "monthly";
    name?: string;
    amount?: number;
    frequency?: string | null;
    customDays?: number | null;
    date?: string | null;
    description?: string | null;
    manualType?: "IN" | "OUT" | null;
    month?: string | null;
    income?: number | null;
    expense?: number | null;
  };

  const catExpenseOther = expenseCategories.find((c) => c.slug === "other")?.id ?? expenseCategories[0]?.id;
  const catIncomeOther = incomeCategories.find((c) => c.slug === "other")?.id ?? incomeCategories[0]?.id;
  if (!catExpenseOther || !catIncomeOther) return { success: false, error: "Нет категорий" };

  if (parsed.type === "monthly") {
    const month = parsed.month ?? `${currentYear}-01`;
    if (!/^\d{4}-\d{2}$/.test(month)) return { success: false, error: "Неверный формат месяца" };
    const income = Math.max(0, Number(parsed.income) || 0);
    const expense = Math.max(0, Number(parsed.expense) || 0);
    const res = await createOrUpdateMonthlyDataAction(profileId, month, income, expense);
    return res?.error ? { success: false, error: res.error } : { success: true };
  }

  if (parsed.amount == null || typeof parsed.amount !== "number" || parsed.amount <= 0) {
    return { success: false, error: "Сумма должна быть положительной" };
  }

  if (parsed.type === "expense") {
    const freq = (parsed.frequency as string) ?? "MONTHLY";
    await createExpense({
      profileId,
      name: parsed.name ?? "Расход",
      amount: parsed.amount,
      frequency: freq,
      categoryId: catExpenseOther,
      customDays: freq === "CUSTOM" && parsed.customDays ? parsed.customDays : undefined,
    });
  } else if (parsed.type === "income") {
    await createIncome({
      profileId,
      name: parsed.name ?? "Доход",
      amount: parsed.amount,
      categoryId: catIncomeOther,
      frequency: (parsed.frequency as string) ?? "MONTHLY",
      customDays: parsed.frequency === "CUSTOM" && parsed.customDays ? parsed.customDays : undefined,
    });
  } else if (parsed.type === "manual") {
    let date: Date;
    if (parsed.date) {
      const d = new Date(parsed.date);
      const now = new Date();
      if (d.getFullYear() < now.getFullYear()) {
        d.setFullYear(now.getFullYear());
      }
      date = d;
    } else {
      date = new Date();
    }
    const manualType = parsed.manualType ?? "OUT";
    await createManualTransaction({
      profileId,
      date,
      type: manualType,
      amount: parsed.amount,
      description: parsed.description ?? parsed.name ?? undefined,
      expenseCategoryId: manualType === "OUT" ? catExpenseOther : undefined,
      incomeCategoryId: manualType === "IN" ? catIncomeOther : undefined,
    });
  } else {
    return { success: false, error: "Не удалось определить тип операции" };
  }
  return { success: true };
}

export async function parseCashFlowTextAction(
  profileId: string,
  text: string,
  expenseCategories: Category[],
  incomeCategories: Category[]
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const parts = text
    .split(/[,;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const errors: string[] = [];
  let successCount = 0;

  for (const part of parts.length > 1 ? parts : [text]) {
    try {
      const res = await parseAndCreate(profileId, part, expenseCategories, incomeCategories);
      if (res.error) {
        errors.push(`${part}: ${res.error}`);
      } else {
        successCount++;
      }
    } catch (e) {
      errors.push(`${part}: ${e instanceof Error ? e.message : "Ошибка парсинга"}`);
    }
  }

  if (successCount === 0 && errors.length > 0) {
    return { error: errors.join(". ") };
  }
  if (errors.length > 0) {
    return { success: true, partialErrors: errors };
  }
  return { success: true };
}

/** Parse text to monthly data only (no DB save). Used in onboarding before profile exists. */
export async function parseMonthlyDataOnlyAction(text: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходах и расходах по месяцам. Верни ТОЛЬКО JSON-массив без markdown.
Формат каждого элемента: {"month":"YYYY-MM","income":число,"expense":число} ИЛИ {"month":"YYYY-MM","entityName":"название","amount":число,"type":"expense"|"income"}

Предпочтительный формат — {"month","income","expense"} для итогов по месяцу.
Примеры:
- "В январе доход 100000 расход 80000" → [{"month":"${currentYear}-01","income":100000,"expense":80000}]
- "Февраль: поступления 120000, расходы 90000" → [{"month":"${currentYear}-02","income":120000,"expense":90000}]
- "В январе: аренда 50000, продажи 100000" → [{"month":"${currentYear}-01","entityName":"аренда","amount":50000,"type":"expense"},{"month":"${currentYear}-01","entityName":"продажи","amount":100000,"type":"income"}]

Правила:
- month в формате YYYY-MM (год ${currentYear} если не указан)
- Либо income+expense (итоги), либо entityName+amount+type (агрегируем по месяцу)

Текст: "${text.trim()}"`;

  const response = await askNeuro(prompt, {});
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  const firstBracket = jsonStr.indexOf("[");
  if (firstBracket >= 0) {
    const lastBracket = jsonStr.lastIndexOf("]");
    if (lastBracket > firstBracket) {
      jsonStr = jsonStr.slice(firstBracket, lastBracket + 1);
    }
  }
  let items: Array<{ month?: string; income?: number; expense?: number; entityName?: string; amount?: number; type?: string }>;
  try {
    items = JSON.parse(jsonStr) as typeof items;
  } catch {
    return { error: "Не удалось распарсить ответ ИИ" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "ИИ не извлёк данные из текста" };
  }

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const it of items) {
    const month = String(it.month ?? "").trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) continue;

    if (typeof it.income === "number" || typeof it.expense === "number") {
      const cur = byMonth.get(month) ?? { income: 0, expense: 0 };
      cur.income += Math.max(0, Number(it.income) || 0);
      cur.expense += Math.max(0, Number(it.expense) || 0);
      byMonth.set(month, cur);
    } else if (it.entityName && typeof it.amount === "number" && it.amount > 0 && (it.type === "expense" || it.type === "income")) {
      const cur = byMonth.get(month) ?? { income: 0, expense: 0 };
      if (it.type === "income") cur.income += it.amount;
      else cur.expense += it.amount;
      byMonth.set(month, cur);
    }
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const data = Array.from(byMonth.entries())
    .filter(([month]) => month < currentMonthKey)
    .map(([month, { income, expense }]) => ({ month, income, expense }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { data };
}

/** Parse text and create ProfileMonthlyData (standalone income/expense per month). */
export async function distributePastDataByAIAction(profileId: string, text: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходах и расходах по месяцам. Верни ТОЛЬКО JSON-массив без markdown.
Формат каждого элемента: {"month":"YYYY-MM","income":число,"expense":число} ИЛИ {"month":"YYYY-MM","entityName":"название","amount":число,"type":"expense"|"income"}

Предпочтительный формат — {"month","income","expense"} для итогов по месяцу.
Примеры:
- "В январе доход 100000 расход 80000" → [{"month":"${currentYear}-01","income":100000,"expense":80000}]
- "Февраль: поступления 120000, расходы 90000" → [{"month":"${currentYear}-02","income":120000,"expense":90000}]
- "В январе: аренда 50000, продажи 100000" → [{"month":"${currentYear}-01","entityName":"аренда","amount":50000,"type":"expense"},{"month":"${currentYear}-01","entityName":"продажи","amount":100000,"type":"income"}]

Правила:
- month в формате YYYY-MM (год ${currentYear} если не указан)
- Либо income+expense (итоги), либо entityName+amount+type (агрегируем по месяцу)

Текст: "${text.trim()}"`;

  const response = await askNeuro(prompt, {});
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  const firstBracket = jsonStr.indexOf("[");
  if (firstBracket >= 0) {
    const lastBracket = jsonStr.lastIndexOf("]");
    if (lastBracket > firstBracket) {
      jsonStr = jsonStr.slice(firstBracket, lastBracket + 1);
    }
  }
  let items: Array<{ month?: string; income?: number; expense?: number; entityName?: string; amount?: number; type?: string }>;
  try {
    items = JSON.parse(jsonStr) as typeof items;
  } catch {
    return { error: "Не удалось распарсить ответ ИИ" };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "ИИ не извлёк данные из текста" };
  }

  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const it of items) {
    const month = String(it.month ?? "").trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) continue;

    if (typeof it.income === "number" || typeof it.expense === "number") {
      const cur = byMonth.get(month) ?? { income: 0, expense: 0 };
      cur.income += Math.max(0, Number(it.income) || 0);
      cur.expense += Math.max(0, Number(it.expense) || 0);
      byMonth.set(month, cur);
    } else if (it.entityName && typeof it.amount === "number" && it.amount > 0 && (it.type === "expense" || it.type === "income")) {
      const cur = byMonth.get(month) ?? { income: 0, expense: 0 };
      if (it.type === "income") cur.income += it.amount;
      else cur.expense += it.amount;
      byMonth.set(month, cur);
    }
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let updated = 0;
  for (const [month, { income, expense }] of byMonth) {
    if (month >= currentMonthKey) continue;
    const res = await createOrUpdateMonthlyDataAction(profileId, month, income, expense);
    if (!res?.error) updated++;
  }
  return { success: true, updated };
}

export type ParsedOnboardingItem = {
  type: "expense" | "income";
  name: string;
  amount: number;
  frequency: string;
  taxes?: number;
  categorySlug?: string;
};

async function parseTextToItem(text: string): Promise<ParsedOnboardingItem | null> {
  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходе или расходе. Верни ТОЛЬКО один JSON объект без markdown:
{"type":"expense"|"income","name":"название","amount":число,"frequency":"MONTHLY"|"QUARTERLY"|"YEARLY"|"WEEKLY"|"DAILY","taxes":число|null,"categorySlug":"rent"|"salary"|"taxes"|"purchases"|"subscriptions"|"utilities"|"marketing"|"insurance"|"equipment"|"transport"|"other"|"sales"|"services"|"investments"|null}

- expense: регулярный расход — name, amount, frequency (MONTHLY, QUARTERLY, YEARLY, WEEKLY, DAILY), taxes опционально 0
- income: регулярный доход — name, amount, frequency, taxes (по умолчанию 0), categorySlug для income: sales, services, salary, investments, rent, other
- categorySlug для expense: rent, salary, taxes, purchases, subscriptions, utilities, marketing, insurance, equipment, transport, other
- Только expense и income, не manual

Текст: "${text.trim()}"`;

  const response = await askNeuro(prompt, {});
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace >= 0) {
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }
  const parsed = JSON.parse(jsonStr) as {
    type?: "expense" | "income";
    name?: string;
    amount?: number;
    frequency?: string;
    taxes?: number | null;
    categorySlug?: string | null;
  };
  if (parsed.type !== "expense" && parsed.type !== "income") return null;
  if (parsed.amount == null || typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
  return {
    type: parsed.type,
    name: parsed.name ?? (parsed.type === "expense" ? "Расход" : "Доход"),
    amount: parsed.amount,
    frequency: parsed.frequency ?? "MONTHLY",
    taxes: parsed.taxes ?? 0,
    categorySlug: parsed.categorySlug ?? undefined,
  };
}

export async function parseCashFlowTextPreviewAction(text: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const parts = text
    .split(/[,;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const items: ParsedOnboardingItem[] = [];
  const errors: string[] = [];

  for (const part of parts.length > 1 ? parts : [text]) {
    try {
      const item = await parseTextToItem(part);
      if (item) items.push(item);
      else errors.push(`${part}: не удалось распарсить`);
    } catch (e) {
      errors.push(`${part}: ${e instanceof Error ? e.message : "Ошибка парсинга"}`);
    }
  }

  if (items.length === 0 && errors.length > 0) {
    return { error: errors.join(". ") };
  }
  return { items, partialErrors: errors.length > 0 ? errors : undefined };
}
