"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile";
import { parseCashFlowTextAction, distributePastDataByAIAction } from "./ai-cashflow";
import { createManualTransaction } from "./cashflow";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export async function completeOnboarding(data: {
  businessName: string;
  currency: string;
  items: Array<{
    type: "expense" | "income";
    name: string;
    amount: number;
    frequency?: string;
    taxes?: number;
    categoryId?: string;
  }>;
  aiText?: string;
  pastDataText?: string;
  monthlyData?: Array<{ month: string; income: number; expense: number }>;
  manual?: Array<{ date: string; amount: number; type: "IN" | "OUT"; description?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };

  const userEmail = session.user.email!;
  const existingUser = await prisma.user.findFirst({
    where: { email: userEmail },
  });
  if (!existingUser) return { error: "Пользователь не найден" };

  const categoryOther = await prisma.expenseCategory.findFirst({
    where: { slug: "other" },
  });
  if (!categoryOther) {
    const categories = [
      { slug: "rent", name: "Аренда", isSystem: true },
      { slug: "salary", name: "Зарплата", isSystem: true },
      { slug: "taxes", name: "Налоги", isSystem: true },
      { slug: "purchases", name: "Закупки", isSystem: true },
      { slug: "subscriptions", name: "Подписки", isSystem: true },
      { slug: "utilities", name: "Коммунальные услуги", isSystem: true },
      { slug: "marketing", name: "Маркетинг", isSystem: true },
      { slug: "insurance", name: "Страхование", isSystem: true },
      { slug: "equipment", name: "Оборудование", isSystem: true },
      { slug: "transport", name: "Транспорт", isSystem: true },
      { slug: "other", name: "Прочее", isSystem: true },
    ];
    for (const c of categories) {
      await prisma.expenseCategory.upsert({
        where: { slug: c.slug },
        create: c,
        update: {},
      });
    }
  }

  const [catExpenseOther, catIncomeOther] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { slug: "other" } }),
    prisma.incomeCategory.findFirst({ where: { slug: "other" } }),
  ]);
  if (!catExpenseOther || !catIncomeOther) return { error: "Категория не найдена" };

  const profile = await prisma.cashFlowProfile.create({
    data: {
      userId: existingUser.id,
      name: data.businessName,
      currency: data.currency,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profile.id, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
  });

  const startDate = new Date();
  startDate.setDate(1);

  const expenseCats = await prisma.expenseCategory.findMany({
    where: { OR: [{ isSystem: true }, { userId: existingUser.id }] },
  });
  const incomeCats = await prisma.incomeCategory.findMany({
    where: { OR: [{ isSystem: true }, { userId: existingUser.id }] },
  });

  for (const item of data.items) {
    if (item.type === "expense" && item.name && item.amount > 0) {
      const catId =
        item.categoryId && expenseCats.some((c) => c.id === item.categoryId)
          ? item.categoryId
          : catExpenseOther.id;
      await prisma.regularExpense.create({
        data: {
          profileId: profile.id,
          categoryId: catId,
          name: item.name,
          amount: item.amount,
          frequency: (item.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY" | "WEEKLY" | "DAILY") ?? "MONTHLY",
          startDate,
        },
      });
    } else if (item.type === "income" && item.name && item.amount > 0) {
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      const catId =
        item.categoryId && incomeCats.some((c) => c.id === item.categoryId)
          ? item.categoryId
          : catIncomeOther.id;
      await prisma.regularIncome.create({
        data: {
          profileId: profile.id,
          name: item.name,
          amount: item.amount,
          taxes: item.taxes ?? 0,
          frequency: (item.frequency as string) ?? "MONTHLY",
          categoryId: catId,
          startDate,
        },
      });
    }
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: existingUser.id },
  });
  if (!sub) {
    await prisma.subscription.create({
      data: {
        userId: existingUser.id,
        plan: "FREE",
        status: "active",
      },
    });
  }

  if (data.aiText?.trim()) {
    const [expenseCategories, incomeCategories] = await Promise.all([
      prisma.expenseCategory.findMany({ where: { OR: [{ isSystem: true }, { userId: existingUser.id }] } }),
      prisma.incomeCategory.findMany({ where: { OR: [{ isSystem: true }, { userId: existingUser.id }] } }),
    ]);
    await parseCashFlowTextAction(profile.id, data.aiText.trim(), expenseCategories, incomeCategories);
  }

  if (data.pastDataText?.trim()) {
    await distributePastDataByAIAction(profile.id, data.pastDataText.trim());
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (const m of data.monthlyData ?? []) {
    if (m.month && /^\d{4}-\d{2}$/.test(m.month) && m.month < currentMonthKey) {
      await prisma.profileMonthlyData.upsert({
        where: { profileId_month: { profileId: profile.id, month: m.month } },
        create: { profileId: profile.id, month: m.month, income: m.income ?? 0, expense: m.expense ?? 0 },
        update: { income: m.income ?? 0, expense: m.expense ?? 0 },
      });
    }
  }

  for (const tx of data.manual ?? []) {
    if (tx.date && typeof tx.amount === "number" && tx.amount > 0 && (tx.type === "IN" || tx.type === "OUT")) {
      await createManualTransaction({
        profileId: profile.id,
        date: new Date(tx.date),
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        expenseCategoryId: tx.type === "OUT" ? catExpenseOther.id : undefined,
        incomeCategoryId: tx.type === "IN" ? catIncomeOther.id : undefined,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { success: true };
}
