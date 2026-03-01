"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
      startDate,
    },
  });
  await saveHistory(data.profileId, "EXPENSE", exp.id, "create", undefined, {
    name: data.name,
    amount: data.amount,
    frequency: data.frequency,
    categoryId: data.categoryId,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateExpense(
  id: string,
  data: { name?: string; amount?: number; frequency?: string; categoryId?: string }
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
  };

  await prisma.regularExpense.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.amount != null && { amount: data.amount }),
      ...(data.frequency && { frequency: data.frequency }),
      ...(data.categoryId && { categoryId: data.categoryId }),
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
  avgCheck: number;
  salesPlan: Record<string, number>;
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

  const inc = await prisma.regularIncome.create({
    data: {
      ...data,
      avgCheck: data.avgCheck,
      salesPlan: data.salesPlan,
    },
  });
  await saveHistory(data.profileId, "INCOME", inc.id, "create", undefined, {
    name: data.name,
    avgCheck: data.avgCheck,
    salesPlan: data.salesPlan,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateIncome(
  id: string,
  data: { name?: string; avgCheck?: number; salesPlan?: Record<string, number> }
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
    avgCheck: Number(inc.avgCheck),
    salesPlan: inc.salesPlan,
  };

  await prisma.regularIncome.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.avgCheck != null && { avgCheck: data.avgCheck }),
      ...(data.salesPlan && { salesPlan: data.salesPlan }),
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
  description?: string;
  categoryId?: string;
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
      ...data,
      amount: data.amount,
    },
  });
  await saveHistory(data.profileId, "MANUAL", tx.id, "create", undefined, {
    date: data.date,
    type: data.type,
    amount: data.amount,
    description: data.description,
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateManualTransaction(
  id: string,
  data: { date?: Date; type?: "IN" | "OUT"; amount?: number; description?: string }
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
    description: tx.description,
  };

  await prisma.manualTransaction.update({
    where: { id },
    data: {
      ...(data.date && { date: data.date }),
      ...(data.type && { type: data.type }),
      ...(data.amount != null && { amount: data.amount }),
      ...(data.description !== undefined && { description: data.description }),
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
    avgCheck: Number(inc.avgCheck),
    salesPlan: inc.salesPlan,
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
