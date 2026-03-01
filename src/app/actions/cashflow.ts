"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getProfileForUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: { profiles: true },
  });
  return user?.profiles[0];
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

  await prisma.regularExpense.create({
    data: {
      profileId: data.profileId,
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId: data.categoryId,
      startDate,
    },
  });
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

  await prisma.regularIncome.create({
    data: {
      ...data,
      avgCheck: data.avgCheck,
      salesPlan: data.salesPlan,
    },
  });
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

  await prisma.manualTransaction.create({
    data: {
      ...data,
      amount: data.amount,
    },
  });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const exp = await prisma.regularExpense.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!exp || exp.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

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

  await prisma.manualTransaction.delete({ where: { id } });
  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true };
}
