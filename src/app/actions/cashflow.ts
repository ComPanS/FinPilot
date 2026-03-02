"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

export async function createExpense(data: {
  profileId: string;
  name: string;
  amount: number;
  frequency: string;
  categoryId: string;
  customDays?: number;
  expectedData?: Record<string, number>;
}) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === data.profileId)) {
    return { error: "Профиль не найден" };
  }

  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const exp = await prisma.regularExpense.create({
    data: {
      profileId: data.profileId,
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId: data.categoryId,
      customDays: data.customDays ?? undefined,
      expectedData: data.expectedData ?? undefined,
      startDate,
    },
  });
  await saveHistory(data.profileId, "EXPENSE", exp.id, "create", undefined, {
    name: data.name,
    amount: data.amount,
    frequency: data.frequency,
    categoryId: data.categoryId,
    customDays: data.customDays,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateExpense(
  id: string,
  data: { name?: string; amount?: number; frequency?: string; categoryId?: string; customDays?: number; expectedData?: Record<string, number> }
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
    },
  });

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
}) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === data.profileId)) {
    return { error: "Профиль не найден" };
  }

  const amt = data.amount ?? data.avgCheck ?? 0;
  const salesPlan = data.salesPlan;
  const frequency = data.frequency ?? "MONTHLY";
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const inc = await prisma.regularIncome.create({
    data: {
      profileId: data.profileId,
      name: data.name,
      amount: amt,
      avgCheck: data.avgCheck,
      taxes: data.taxes ?? undefined,
      salesPlan: salesPlan ?? undefined,
      frequency,
      customDays: data.customDays ?? undefined,
      categoryId: data.categoryId ?? undefined,
      expectedData: data.expectedData ?? undefined,
      startDate,
    },
  });
  await saveHistory(data.profileId, "INCOME", inc.id, "create", undefined, {
    name: data.name,
    amount: amt,
    taxes: data.taxes,
    salesPlan,
    frequency,
    categoryId: data.categoryId,
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
    },
  });

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
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === data.profileId)) {
    return { error: "Профиль не найден" };
  }

  const tx = await prisma.manualTransaction.create({
    data: {
      profileId: data.profileId,
      date: data.date,
      type: data.type,
      amount: data.amount,
      taxes: data.taxes ?? undefined,
      description: data.description,
      expenseCategoryId: data.type === "OUT" ? data.expenseCategoryId : undefined,
      incomeCategoryId: data.type === "IN" ? data.incomeCategoryId : undefined,
    },
  });
  await saveHistory(data.profileId, "MANUAL", tx.id, "create", undefined, {
    date: data.date,
    type: data.type,
    amount: data.amount,
    taxes: data.taxes,
    description: data.description,
    expenseCategoryId: data.expenseCategoryId,
    incomeCategoryId: data.incomeCategoryId,
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
