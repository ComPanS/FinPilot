"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function isValidPeriod(period: string): boolean {
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(period)) return true;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return true;
  // YYYY-MM-DD:YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(period)) return true;
  return false;
}

function periodContainsFutureDate(period: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const lastDay = new Date(y!, m!, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return monthEnd > today;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period > today;
  const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (m) return m[2]! > today;
  return false;
}

export async function saveActualEntry(
  profileId: string,
  entityType: "EXPENSE" | "INCOME",
  entityId: string,
  period: string,
  amount: number
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

  if (!isValidPeriod(period)) {
    return { error: "Некорректный формат периода" };
  }
  if (periodContainsFutureDate(period)) {
    return { error: "Нельзя добавлять будущие даты" };
  }
  if (amount < 0 || !Number.isFinite(amount)) {
    return { error: "Сумма не может быть отрицательной" };
  }

  await prisma.actualEntry.upsert({
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
      amount,
    },
    update: { amount },
  });

  revalidatePath("/fact");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteActualEntry(
  profileId: string,
  entityType: "EXPENSE" | "INCOME",
  entityId: string,
  period: string
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

  await prisma.actualEntry.deleteMany({
    where: {
      profileId,
      entityType,
      entityId,
      period,
    },
  });

  revalidatePath("/fact");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getActualEntriesForEntity(
  profileId: string,
  entityType: "EXPENSE" | "INCOME",
  entityId: string
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

  const entries = await prisma.actualEntry.findMany({
    where: {
      profileId,
      entityType,
      entityId,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    entries: entries.map((e) => ({
      period: e.period,
      amount: Number(e.amount),
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
