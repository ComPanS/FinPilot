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
  categories: Category[]
): Promise<{ success: boolean; error?: string }> {
  const currentYear = new Date().getFullYear();
  const prompt = `Распарсь текст о доходе или расходе. Верни ТОЛЬКО один JSON объект без markdown:
{"type":"expense"|"income"|"manual","name":"название","amount":число,"frequency":"MONTHLY"|"QUARTERLY"|"YEARLY"|null,"date":"YYYY-MM-DD"|null,"description":строка|null,"manualType":"IN"|"OUT"|null}

- expense: регулярный расход — name, amount, frequency
- income: регулярный доход — name, amount
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
    date?: string | null;
    description?: string | null;
    manualType?: "IN" | "OUT" | null;
  };

  const catOther = categories.find((c) => c.slug === "other")?.id ?? categories[0]?.id;
  if (!catOther) return { error: "Нет категорий" };

  if (parsed.type === "expense") {
    await createExpense({
      profileId,
      name: parsed.name ?? "Расход",
      amount: parsed.amount,
      frequency: (parsed.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY") ?? "MONTHLY",
      categoryId: catOther,
    });
  } else if (parsed.type === "income") {
    const salesPlan: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) salesPlan[String(m)] = parsed.amount;
    await createIncome({
      profileId,
      name: parsed.name ?? "Доход",
      avgCheck: parsed.amount,
      salesPlan,
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
    await createManualTransaction({
      profileId,
      date,
      type: parsed.manualType ?? "OUT",
      amount: parsed.amount,
      description: parsed.description ?? parsed.name ?? undefined,
    });
  } else {
    return { error: "Не удалось определить тип операции" };
  }
  return { success: true };
}

export async function parseCashFlowTextAction(
  profileId: string,
  text: string,
  categories: Category[]
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
      const res = await parseAndCreate(profileId, part, categories);
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
