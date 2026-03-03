"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { askNeuro } from "@/lib/neuroapi";
import { createExpense } from "./cashflow";
import { createIncome } from "./cashflow";
import { createManualTransaction } from "./cashflow";

type Category = { id: string; name: string; slug: string };

async function parseAndCreate(
  profileId: string,
  text: string,
  expenseCategories: Category[],
  incomeCategories: Category[]
): Promise<{ success: boolean; error?: string }> {
  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходе или расходе. Верни ТОЛЬКО один JSON объект без markdown:
{"type":"expense"|"income"|"manual","name":"название","amount":число,"frequency":"MONTHLY"|"QUARTERLY"|"YEARLY"|"WEEKLY"|"DAILY"|"CUSTOM"|null,"customDays":число|null,"date":"YYYY-MM-DD"|null,"description":строка|null,"manualType":"IN"|"OUT"|null}

- expense: регулярный расход — name, amount, frequency (MONTHLY, QUARTERLY, YEARLY, WEEKLY, DAILY, или CUSTOM с customDays)
- income: регулярный доход — name, amount, frequency (MONTHLY, QUARTERLY, YEARLY, WEEKLY, DAILY, CUSTOM с customDays)
- manual: разовая операция — name или description, amount, manualType "IN" или "OUT", date в YYYY-MM-DD
- ВАЖНО: если указан только день и месяц (например 10.03, 15 марта) — используй год ${currentYear}

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
    type: "expense" | "income" | "manual";
    name?: string;
    amount: number;
    frequency?: string | null;
    customDays?: number | null;
    date?: string | null;
    description?: string | null;
    manualType?: "IN" | "OUT" | null;
  };

  const catExpenseOther = expenseCategories.find((c) => c.slug === "other")?.id ?? expenseCategories[0]?.id;
  const catIncomeOther = incomeCategories.find((c) => c.slug === "other")?.id ?? incomeCategories[0]?.id;
  if (!catExpenseOther || !catIncomeOther) return { success: false, error: "Нет категорий" };

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
