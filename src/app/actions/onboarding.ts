"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseCashFlowTextAction } from "./ai-cashflow";

export async function completeOnboarding(data: {
  businessName: string;
  currency: string;
  items: Array<{
    type: "expense" | "income";
    name: string;
    amount: number;
    frequency?: string;
  }>;
  aiText?: string;
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

  await prisma.user.update({
    where: { id: existingUser.id },
    data: { businessName: data.businessName },
  });

  const profile = await prisma.cashFlowProfile.create({
    data: {
      userId: existingUser.id,
      name: data.businessName,
      currency: data.currency,
    },
  });

  const startDate = new Date();
  startDate.setDate(1);

  for (const item of data.items) {
    if (item.type === "expense" && item.name && item.amount > 0) {
      await prisma.regularExpense.create({
        data: {
          profileId: profile.id,
          categoryId: catExpenseOther.id,
          name: item.name,
          amount: item.amount,
          frequency: (item.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY") ?? "MONTHLY",
          startDate,
        },
      });
    } else if (item.type === "income" && item.name && item.amount > 0) {
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      await prisma.regularIncome.create({
        data: {
          profileId: profile.id,
          name: item.name,
          amount: item.amount,
          frequency: (item.frequency as string) ?? "MONTHLY",
          categoryId: catIncomeOther.id,
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

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { success: true };
}
