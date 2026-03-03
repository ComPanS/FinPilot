"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { parseCashFlowTextAction } from "./ai-cashflow";

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export async function switchProfileAction(profileId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function createProfileAction(data: {
  name: string;
  currency?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profiles: true },
  });
  if (!user) return { error: "Пользователь не найден" };

  const profile = await prisma.cashFlowProfile.create({
    data: {
      userId: user.id,
      name: data.name.trim() || "Новый профиль",
      currency: data.currency ?? "RUB",
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profile.id, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { success: true, profileId: profile.id };
}

export async function addProfileWithSetupAction(data: {
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
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };

  const existingUser = await prisma.user.findFirst({
    where: { email: session.user.email! },
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
      name: data.businessName.trim() || "Новый профиль",
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
      const sd = new Date();
      sd.setDate(1);
      sd.setHours(0, 0, 0, 0);
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
          startDate: sd,
        },
      });
    }
  }

  if (data.aiText?.trim()) {
    const [expenseCategories, incomeCategories] = await Promise.all([
      prisma.expenseCategory.findMany({
        where: { OR: [{ isSystem: true }, { userId: existingUser.id }] },
      }),
      prisma.incomeCategory.findMany({
        where: { OR: [{ isSystem: true }, { userId: existingUser.id }] },
      }),
    ]);
    await parseCashFlowTextAction(
      profile.id,
      data.aiText.trim(),
      expenseCategories,
      incomeCategories
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/profiles/new");
  return { success: true };
}
