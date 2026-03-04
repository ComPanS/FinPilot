"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/** Get historical + expected data for chart (12 months ahead) */
export async function getExpectedChartData(
  profileId: string,
  entityId: string,
  entityType: "EXPENSE" | "INCOME"
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

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (mk >= currentMonthKey) monthKeys.push(mk);
  }

  const entries = await prisma.expectedEntry.findMany({
    where: {
      profileId,
      entityType,
      entityId,
      period: { in: monthKeys },
    },
  });
  const expectedByMonth = new Map(entries.map((e) => [e.period, Number(e.amount)]));

  // Merge with expectedData from entity (backward compat) - fetch entity
  const entity = await (entityType === "EXPENSE"
    ? prisma.regularExpense.findUnique({ where: { id: entityId } })
    : prisma.regularIncome.findUnique({ where: { id: entityId } }));
  const expectedDataJson = (entity as { expectedData?: unknown })?.expectedData as Record<string, number> | null | undefined;
  if (expectedDataJson && typeof expectedDataJson === "object") {
    for (const [period, amount] of Object.entries(expectedDataJson)) {
      if (/^\d{4}-\d{2}$/.test(period) && period >= currentMonthKey && amount != null && !expectedByMonth.has(period)) {
        expectedByMonth.set(period, Number(amount));
      }
    }
  }

  // Только ожидаемые по этой статье. Фактические по статье — в будущем.
  const data = monthKeys.map((mk) => ({
    month: mk,
    expected: expectedByMonth.get(mk) ?? 0,
  }));

  return { data };
}

/** Auto-generate expected from history (linear trend from last N months) */
export async function generateExpectedFromHistory(
  profileId: string,
  entityId: string,
  entityType: "EXPENSE" | "INCOME",
  monthsAhead: number = 6
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

  const entries = await prisma.expectedEntry.findMany({
    where: {
      profileId,
      entityType,
      entityId,
      source: "MANUAL",
    },
    orderBy: { period: "asc" },
    take: 12,
  });

  if (entries.length < 2) {
    return { error: "Нужно минимум 2 месяца данных для расчёта тренда" };
  }

  const values = entries.map((e) => Number(e.amount));
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const lastPeriod = entries[n - 1]!.period;
  const [lastY, lastM] = lastPeriod.split("-").map(Number);
  const result: Record<string, number> = {};

  for (let i = 1; i <= monthsAhead; i++) {
    let y = lastY;
    let m = lastM + i;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    const period = `${y}-${String(m).padStart(2, "0")}`;
    if (period < currentMonthKey) continue;
    const predicted = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
    result[period] = predicted;
  }

  for (const [period, amount] of Object.entries(result)) {
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
        amount,
        source: "AUTO_HISTORICAL",
        confidence: 0.85,
      },
      update: { amount, source: "AUTO_HISTORICAL", confidence: 0.85 },
    });
  }

  // Sync to entity expectedData for UI (только текущий месяц и далее)
  const existing = entityType === "EXPENSE"
    ? (await prisma.regularExpense.findUnique({ where: { id: entityId } }))?.expectedData
    : (await prisma.regularIncome.findUnique({ where: { id: entityId } }))?.expectedData;
  const mergedRaw = { ...(typeof existing === "object" && existing ? (existing as Record<string, number>) : {}), ...result };
  const merged = Object.fromEntries(Object.entries(mergedRaw).filter(([k]) => k >= currentMonthKey));
  if (entityType === "EXPENSE") {
    await prisma.regularExpense.update({
      where: { id: entityId },
      data: { expectedData: merged },
    });
  } else {
    await prisma.regularIncome.update({
      where: { id: entityId },
      data: { expectedData: merged },
    });
  }

  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true, generated: result };
}

/** Copy expected from previous year with optional seasonal multiplier */
export async function copyExpectedFromPreviousYear(
  profileId: string,
  entityId: string,
  entityType: "EXPENSE" | "INCOME",
  year: number,
  seasonalMultiplier?: Record<string, number>
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

  const prevYear = year - 1;
  const entries = await prisma.expectedEntry.findMany({
    where: {
      profileId,
      entityType,
      entityId,
      period: { startsWith: `${prevYear}-` },
    },
  });

  if (entries.length === 0) {
    return { error: "Нет данных за прошлый год" };
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const expectedData: Record<string, number> = {};
  for (const e of entries) {
    const [, month] = e.period.split("-");
    const period = `${year}-${month}`;
    if (period < currentMonthKey) continue;
    let amount = Number(e.amount);
    if (seasonalMultiplier && seasonalMultiplier[month] != null) {
      amount *= seasonalMultiplier[month];
    }
    amount = Math.max(0, Math.round(amount));
    expectedData[period] = amount;

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
        amount,
        source: "MANUAL",
        confidence: 1.0,
      },
      update: { amount },
    });
  }

  // Sync to entity expectedData for UI (только текущий месяц и далее)
  const existing = entityType === "EXPENSE"
    ? (await prisma.regularExpense.findUnique({ where: { id: entityId } }))?.expectedData
    : (await prisma.regularIncome.findUnique({ where: { id: entityId } }))?.expectedData;
  const mergedRaw = { ...(typeof existing === "object" && existing ? (existing as Record<string, number>) : {}), ...expectedData };
  const merged = Object.fromEntries(Object.entries(mergedRaw).filter(([k]) => k >= currentMonthKey));
  if (entityType === "EXPENSE") {
    await prisma.regularExpense.update({
      where: { id: entityId },
      data: { expectedData: merged },
    });
  } else {
    await prisma.regularIncome.update({
      where: { id: entityId },
      data: { expectedData: merged },
    });
  }

  revalidatePath("/cashflow");
  revalidatePath("/dashboard");
  return { success: true, expectedData: merged };
}
