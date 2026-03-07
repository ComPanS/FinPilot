"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createExpenseSchema, createIncomeSchema, createManualTransactionSchema } from "@/lib/schemas/cashflow";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "custom";
}

export async function createCategory(data: { userId: string; name: string }) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.id !== data.userId) {
    return { error: "Профиль не найден" };
  }

  const baseSlug = slugify(data.name);
  const slug = `${baseSlug}-${data.userId.slice(0, 8)}`;
  const existing = await prisma.expenseCategory.findUnique({
    where: { slug },
  });
  if (existing) {
    return { category: existing };
  }

  const category = await prisma.expenseCategory.create({
    data: {
      name: data.name,
      slug,
      userId: data.userId,
      isSystem: false,
    },
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { category };
}

export async function createIncomeCategory(data: { userId: string; name: string }) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.id !== data.userId) {
    return { error: "Профиль не найден" };
  }

  const baseSlug = slugify(data.name);
  const slug = `${baseSlug}-${data.userId.slice(0, 8)}`;
  const existing = await prisma.incomeCategory.findUnique({
    where: { slug },
  });
  if (existing) {
    return { category: existing };
  }

  const category = await prisma.incomeCategory.create({
    data: {
      name: data.name,
      slug,
      userId: data.userId,
      isSystem: false,
    },
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { category };
}

async function saveHistory(
  profileId: string,
  entityType: string,
  entityId: string,
  action: string,
  oldData?: object,
  newData?: object
) {
  await prisma.cashFlowHistory.create({
    data: {
      profileId,
      entityType,
      entityId,
      action,
      oldData: oldData ?? undefined,
      newData: newData ?? undefined,
    },
  });
}

async function saveForecastSnapshot(profileId: string, forecastData: object[]) {
  await prisma.forecastSnapshot.create({
    data: {
      profileId,
      snapshotDate: new Date(),
      forecastData,
    },
  });
}

/** Sync expectedData (JSON) to ExpectedEntry table for forecast resolution */
async function syncExpectedDataToEntries(
  profileId: string,
  entityType: "EXPENSE" | "INCOME",
  entityId: string,
  expectedData: Record<string, number>
) {
  const periods = Object.keys(expectedData).filter((k) => /^\d{4}-\d{2}$/.test(k));
  await prisma.expectedEntry.deleteMany({
    where: { profileId, entityType, entityId },
  });
  for (const period of periods) {
    const amount = expectedData[period];
    if (amount != null && !Number.isNaN(Number(amount)) && Number(amount) > 0) {
      await prisma.expectedEntry.upsert({
        where: {
          profileId_entityType_entityId_period: {
            profileId,
            entityType,
            entityId,
            period,
          },
        },
        create: {
          profileId,
          entityType,
          entityId,
          period,
          amount: Number(amount),
          source: "MANUAL",
          confidence: 1.0,
        },
        update: { amount: Number(amount) },
      });
    }
  }
}

export async function createExpense(data: {
  profileId: string;
  name: string;
  amount: number;
  frequency: string;
  categoryId: string;
  customDays?: number;
  expectedData?: Record<string, number>;
  seasonalMultiplier?: Record<string, number>;
}) {
  const parsed = createExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Неверные данные" };
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  const d = parsed.data;
  if (!user || !user.profiles.some((p) => p.id === d.profileId)) {
    return { error: "Профиль не найден" };
  }

  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const exp = await prisma.regularExpense.create({
    data: {
      profileId: d.profileId,
      name: d.name,
      amount: d.amount,
      frequency: d.frequency,
      categoryId: d.categoryId,
      customDays: d.customDays ?? undefined,
      expectedData: d.expectedData ?? undefined,
      seasonalMultiplier: d.seasonalMultiplier ?? undefined,
      startDate,
    },
  });
  if (d.expectedData && Object.keys(d.expectedData).length > 0) {
    await syncExpectedDataToEntries(d.profileId, "EXPENSE", exp.id, d.expectedData);
  }
  await saveHistory(d.profileId, "EXPENSE", exp.id, "create", undefined, {
    name: d.name,
    amount: d.amount,
    frequency: d.frequency,
    categoryId: d.categoryId,
    customDays: d.customDays,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateExpense(
  id: string,
  data: { name?: string; amount?: number; frequency?: string; categoryId?: string; customDays?: number; expectedData?: Record<string, number>; seasonalMultiplier?: Record<string, number> }
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const exp = await prisma.regularExpense.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!exp || exp.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    name: exp.name,
    amount: Number(exp.amount),
    frequency: exp.frequency,
    categoryId: exp.categoryId,
    customDays: exp.customDays,
    expectedData: exp.expectedData,
  };

  await prisma.regularExpense.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.amount != null && { amount: data.amount }),
      ...(data.frequency && { frequency: data.frequency }),
      ...(data.categoryId && { categoryId: data.categoryId }),
      ...(data.customDays !== undefined && { customDays: data.customDays }),
      ...(data.expectedData !== undefined && { expectedData: data.expectedData }),
      ...(data.seasonalMultiplier !== undefined && { seasonalMultiplier: data.seasonalMultiplier }),
    },
  });

  if (data.expectedData !== undefined) {
    await syncExpectedDataToEntries(exp.profileId, "EXPENSE", id, data.expectedData);
  }

  const newData = { ...oldData, ...data };
  await saveHistory(exp.profileId, "EXPENSE", id, "update", oldData, newData);
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createIncome(data: {
  profileId: string;
  name: string;
  amount?: number;
  avgCheck?: number;
  taxes?: number;
  salesPlan?: Record<string, number>;
  frequency?: string;
  categoryId?: string;
  customDays?: number;
  expectedData?: Record<string, number>;
  seasonalMultiplier?: Record<string, number>;
}) {
  const parsed = createIncomeSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Неверные данные" };
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const d = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === d.profileId)) {
    return { error: "Профиль не найден" };
  }

  const amt = d.amount ?? d.avgCheck ?? 0;
  const salesPlan = d.salesPlan;
  const frequency = d.frequency ?? "MONTHLY";
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const inc = await prisma.regularIncome.create({
    data: {
      profileId: d.profileId,
      name: d.name,
      amount: amt,
      avgCheck: d.avgCheck,
      taxes: d.taxes ?? undefined,
      salesPlan: salesPlan ?? undefined,
      frequency,
      customDays: d.customDays ?? undefined,
      categoryId: d.categoryId ?? undefined,
      expectedData: d.expectedData ?? undefined,
      seasonalMultiplier: d.seasonalMultiplier ?? undefined,
      startDate,
    },
  });
  if (d.expectedData && Object.keys(d.expectedData).length > 0) {
    await syncExpectedDataToEntries(d.profileId, "INCOME", inc.id, d.expectedData);
  }
  await saveHistory(d.profileId, "INCOME", inc.id, "create", undefined, {
    name: d.name,
    amount: amt,
    taxes: d.taxes,
    salesPlan,
    frequency,
    categoryId: d.categoryId,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateIncome(
  id: string,
  data: {
    name?: string;
    amount?: number;
    avgCheck?: number;
    taxes?: number;
    salesPlan?: Record<string, number>;
    frequency?: string;
    categoryId?: string;
    customDays?: number;
    expectedData?: Record<string, number>;
    seasonalMultiplier?: Record<string, number>;
  }
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const inc = await prisma.regularIncome.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!inc || inc.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    name: inc.name,
    amount: inc.amount != null ? Number(inc.amount) : undefined,
    avgCheck: inc.avgCheck != null ? Number(inc.avgCheck) : undefined,
    taxes: inc.taxes != null ? Number(inc.taxes) : undefined,
    salesPlan: inc.salesPlan,
    frequency: inc.frequency,
    categoryId: inc.categoryId,
    customDays: inc.customDays,
    expectedData: inc.expectedData,
  };

  await prisma.regularIncome.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.amount != null && { amount: data.amount }),
      ...(data.avgCheck != null && { avgCheck: data.avgCheck }),
      ...(data.taxes !== undefined && { taxes: data.taxes }),
      ...(data.salesPlan && { salesPlan: data.salesPlan }),
      ...(data.frequency && { frequency: data.frequency }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.customDays !== undefined && { customDays: data.customDays }),
      ...(data.expectedData !== undefined && { expectedData: data.expectedData }),
      ...(data.seasonalMultiplier !== undefined && { seasonalMultiplier: data.seasonalMultiplier }),
    },
  });

  if (data.expectedData !== undefined) {
    await syncExpectedDataToEntries(inc.profileId, "INCOME", id, data.expectedData);
  }

  const newData = { ...oldData, ...data };
  await saveHistory(inc.profileId, "INCOME", id, "update", oldData, newData);
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createManualTransaction(data: {
  profileId: string;
  date: Date;
  type: "IN" | "OUT";
  amount: number;
  taxes?: number;
  description?: string;
  expenseCategoryId?: string;
  incomeCategoryId?: string;
}) {
  const parsed = createManualTransactionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Неверные данные" };
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const d = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === d.profileId)) {
    return { error: "Профиль не найден" };
  }

  const tx = await prisma.manualTransaction.create({
    data: {
      profileId: d.profileId,
      date: d.date,
      type: d.type,
      amount: d.amount,
      taxes: d.taxes ?? undefined,
      description: d.description,
      expenseCategoryId: d.type === "OUT" ? d.expenseCategoryId : undefined,
      incomeCategoryId: d.type === "IN" ? d.incomeCategoryId : undefined,
    },
  });
  await saveHistory(d.profileId, "MANUAL", tx.id, "create", undefined, {
    date: d.date,
    type: d.type,
    amount: d.amount,
    taxes: d.taxes,
    description: d.description,
    expenseCategoryId: d.expenseCategoryId,
    incomeCategoryId: d.incomeCategoryId,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateManualTransaction(
  id: string,
  data: { date?: Date; type?: "IN" | "OUT"; amount?: number; taxes?: number; description?: string; expenseCategoryId?: string | null; incomeCategoryId?: string | null }
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const tx = await prisma.manualTransaction.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!tx || tx.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    date: tx.date,
    type: tx.type,
    amount: Number(tx.amount),
    taxes: tx.taxes != null ? Number(tx.taxes) : undefined,
    description: tx.description,
    expenseCategoryId: tx.expenseCategoryId,
    incomeCategoryId: tx.incomeCategoryId,
  };

  await prisma.manualTransaction.update({
    where: { id },
    data: {
      ...(data.date && { date: data.date }),
      ...(data.type && { type: data.type }),
      ...(data.amount != null && { amount: data.amount }),
      ...(data.taxes !== undefined && { taxes: data.taxes }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.expenseCategoryId !== undefined && { expenseCategoryId: data.expenseCategoryId ?? null }),
      ...(data.incomeCategoryId !== undefined && { incomeCategoryId: data.incomeCategoryId ?? null }),
    },
  });

  const newData = { ...oldData, ...data };
  await saveHistory(tx.profileId, "MANUAL", id, "update", oldData, newData);
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const exp = await prisma.regularExpense.findFirst({
    where: { id },
    include: { profile: { include: { user: true } }, category: true },
  });
  if (!exp || exp.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    name: exp.name,
    amount: Number(exp.amount),
    frequency: exp.frequency,
    categoryId: exp.categoryId,
    customDays: exp.customDays,
  };
  await saveHistory(exp.profileId, "EXPENSE", id, "delete", oldData, undefined);

  await prisma.regularExpense.delete({ where: { id } });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteIncome(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const inc = await prisma.regularIncome.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!inc || inc.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    name: inc.name,
    amount: inc.amount != null ? Number(inc.amount) : undefined,
    avgCheck: inc.avgCheck != null ? Number(inc.avgCheck) : undefined,
    salesPlan: inc.salesPlan,
    frequency: inc.frequency,
    categoryId: inc.categoryId,
  };
  await saveHistory(inc.profileId, "INCOME", id, "delete", oldData, undefined);

  await prisma.regularIncome.delete({ where: { id } });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteManualTransaction(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const tx = await prisma.manualTransaction.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!tx || tx.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  const oldData = {
    date: tx.date,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
  };
  await saveHistory(tx.profileId, "MANUAL", id, "delete", oldData, undefined);

  await prisma.manualTransaction.delete({ where: { id } });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getCashFlowHistory(profileId: string, entityId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const history = await prisma.cashFlowHistory.findMany({
    where: { profileId, entityId },
    orderBy: { createdAt: "desc" },
  });
  return { history };
}

export async function getForecastSnapshots(profileId: string, limit = 30) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const snapshots = await prisma.forecastSnapshot.findMany({
    where: { profileId },
    orderBy: { snapshotDate: "desc" },
    take: limit,
  });
  return { snapshots };
}

export async function saveForecastSnapshotAction(
  profileId: string,
  forecastData: { date: string; balance: number; inflows: number; outflows: number }[]
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

  await saveForecastSnapshot(profileId, forecastData);
  return { success: true };
}

export async function createOrUpdateMonthlyDataAction(
  profileId: string,
  month: string,
  income: number,
  expense: number
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

  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Неверный формат месяца (YYYY-MM)" };
  if (income < 0 || expense < 0) return { error: "Суммы не могут быть отрицательными" };

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month >= currentMonthKey) return { error: "Можно добавлять только данные за прошлые месяцы" };

  await prisma.profileMonthlyData.upsert({
    where: { profileId_month: { profileId, month } },
    create: { profileId, month, income, expense },
    update: { income, expense },
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMonthlyDataAction(profileId: string, month: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  await prisma.profileMonthlyData.deleteMany({
    where: { profileId, month },
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}
