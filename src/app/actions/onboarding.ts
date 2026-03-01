"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function completeOnboarding(data: {
  businessName: string;
  currency: string;
  items: Array<{
    type: "expense" | "income";
    name: string;
    amount: number;
    frequency?: string;
  }>;
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

  const catOther = await prisma.expenseCategory.findFirst({
    where: { slug: "other" },
  });
  if (!catOther) return { error: "Категория не найдена" };

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
          categoryId: catOther.id,
          name: item.name,
          amount: item.amount,
          frequency: (item.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY") ?? "MONTHLY",
          startDate,
        },
      });
    } else if (item.type === "income" && item.name && item.amount > 0) {
      const salesPlan: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) salesPlan[String(m)] = item.amount;
      await prisma.regularIncome.create({
        data: {
          profileId: profile.id,
          name: item.name,
          avgCheck: item.amount,
          salesPlan,
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

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { success: true };
}
