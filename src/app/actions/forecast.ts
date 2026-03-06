"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeForecast, computeForecastActualOnly, computeForecastDebug, computeForecastDebugState } from "@/lib/services/forecast";
import { countDaysWithFactData } from "@/lib/services/fact-stats";
import type { WhatIfChanges } from "@/types";

/** Возвращает ВСЕ данные с сервера для отладки дашборда */
export async function getDashboardFullDebugAction(profileId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profiles: {
        where: { id: profileId },
        include: {
          regularExpenses: { include: { category: true } },
          regularIncomes: { include: { category: true } },
          monthlyData: true,
        },
      },
      subscription: true,
    },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const profile = user.profiles.find((p) => p.id === profileId)!;
  const now = new Date();
  const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const [forecastRes, forecastFactOnly, actualEntries, expectedEntries, manualTransactions, forecastDebug, debugState] =
    await Promise.all([
      computeForecast(profileId, {
        days: daysInMonth,
        startDate: new Date(firstOfMonthStr + "T12:00:00"),
        useExpectedData: true,
        useActualData: true,
        usePatterns: true,
        zoneGreenMin: profile.zoneGreenMin ?? 50000,
        zoneRedMax: profile.zoneRedMax ?? -50000,
      }),
      computeForecastActualOnly(profileId, {
        days: daysInMonth,
        startDate: new Date(firstOfMonthStr + "T12:00:00"),
      }),
      prisma.actualEntry.findMany({ where: { profileId }, orderBy: { period: "asc" } }),
      prisma.expectedEntry.findMany({ where: { profileId }, orderBy: { period: "asc" } }),
      prisma.manualTransaction.findMany({ where: { profileId }, orderBy: { date: "asc" } }),
      computeForecastDebug(profileId, { days: 90 }),
      computeForecastDebugState(profileId, {
        startDate: new Date(firstOfMonthStr + "T12:00:00"),
        days: daysInMonth,
      }),
    ]);

  const hasEntityExpectedData = [
    ...profile.regularExpenses,
    ...profile.regularIncomes,
  ].some((e) => {
    const ed = (e as { expectedData?: Record<string, number> | null }).expectedData;
    return ed && typeof ed === "object" && Object.keys(ed).length > 0;
  });
  const hasMonthlyData = profile.monthlyData.length > 0;
  const hasAtLeast10DaysOfFact = (await countDaysWithFactData(profileId)) >= 10;
  const hasAnyExpectedData = hasEntityExpectedData || hasMonthlyData || hasAtLeast10DaysOfFact;

  let expectedForecastRes: Awaited<ReturnType<typeof getForecastAction>> | null = null;
  if (hasAnyExpectedData) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const expectedDays =
      Math.ceil((expectedEnd.getTime() - nextMonth.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    expectedForecastRes = await getForecastAction(profileId, {
      days: Math.max(90, expectedDays + 30),
      useExpectedData: true,
      returnBoth: true,
    });
  }

  return {
    inputParams: {
      firstCall: { startDate: firstOfMonthStr, days: daysInMonth, useExpectedData: true, returnBoth: true },
      secondCall: hasAnyExpectedData
        ? { days: 120, useExpectedData: true, returnBoth: true }
        : null,
    },
    profile: {
      id: profile.id,
      name: profile.name,
      currency: profile.currency,
      zoneGreenMin: profile.zoneGreenMin,
      zoneRedMax: profile.zoneRedMax,
      regularExpenses: profile.regularExpenses.map((e) => ({
        id: e.id,
        name: e.name,
        amount: Number(e.amount),
        frequency: e.frequency,
        startDate: e.startDate.toISOString(),
        categoryId: e.categoryId,
        category: e.category ? { id: e.category.id, name: e.category.name, slug: e.category.slug } : null,
        expectedData: (e as { expectedData?: unknown }).expectedData,
      })),
      regularIncomes: profile.regularIncomes.map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount != null ? Number(i.amount) : null,
        avgCheck: i.avgCheck != null ? Number(i.avgCheck) : null,
        frequency: i.frequency,
        taxes: i.taxes != null ? Number(i.taxes) : null,
        startDate: i.startDate?.toISOString() ?? null,
        categoryId: i.categoryId,
        category: i.category ? { id: i.category.id, name: i.category.name, slug: i.category.slug } : null,
        expectedData: (i as { expectedData?: unknown }).expectedData,
      })),
      monthlyData: profile.monthlyData.map((m) => ({
        month: m.month,
        income: Number(m.income),
        expense: Number(m.expense),
      })),
    },
    forecastRes: {
      forecast: forecastRes.forecast.map((d) => ({
        date: d.date,
        balance: d.balance,
        inflows: d.inflows,
        outflows: d.outflows,
      })),
      usedPatterns: forecastRes.usedPatterns,
      hasEnoughPatternData: forecastRes.hasEnoughPatternData,
    },
    forecastFactOnly: forecastFactOnly.map((d) => ({
      date: d.date,
      balance: d.balance,
      inflows: d.inflows,
      outflows: d.outflows,
      hasFactData: d.hasFactData,
    })),
    expectedForecastRes: expectedForecastRes
      ? {
          forecastExpected: (expectedForecastRes.forecastExpected ?? []).map((d) => ({
            date: d.date,
            balance: d.balance,
            inflows: d.inflows,
            outflows: d.outflows,
          })),
          forecastFactOnly: (expectedForecastRes.forecastFactOnly ?? []).map((d) => ({
            date: d.date,
            balance: d.balance,
            inflows: d.inflows,
            outflows: d.outflows,
            hasFactData: d.hasFactData,
          })),
          usedPatterns: expectedForecastRes.usedPatterns,
          hasEnoughPatternData: expectedForecastRes.hasEnoughPatternData,
        }
      : null,
    actualEntries: actualEntries.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      period: e.period,
      amount: Number(e.amount),
    })),
    expectedEntries: expectedEntries.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      period: e.period,
      amount: Number(e.amount),
      source: e.source,
    })),
    manualTransactions: manualTransactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      type: t.type,
      amount: Number(t.amount),
      taxes: t.taxes != null ? Number(t.taxes) : null,
      description: t.description,
    })),
    forecastDebug,
    debugState: {
      monthlyByMonth: debugState.monthlyByMonth,
      monthlyByMonthSource: debugState.source,
      dailySampleFirst3: forecastRes.forecast.slice(0, 3).map((d) => ({
        date: d.date,
        inflows: d.inflows,
        outflows: d.outflows,
      })),
    },
  };
}

export async function getForecastDebugAction(profileId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }
  const days = user.subscription?.plan === "FREE" ? 30 : 90;
  return computeForecastDebug(profileId, { days });
}

export async function getForecastAction(
  profileId: string,
  options?: {
    days?: number;
    startDate?: Date | string;
    changes?: WhatIfChanges;
    useExpectedData?: boolean;
    useActualData?: boolean;
    usePatterns?: boolean;
    patternLookbackMonths?: number;
    returnBoth?: boolean;
  },
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const profile = user.profiles.find((p) => p.id === profileId)!;
  const defaultDays = user.subscription?.plan === "FREE" ? 30 : 90;
  const days = options?.days ?? defaultDays;
  const startDate = options?.startDate
    ? typeof options.startDate === "string"
      ? new Date(
          options.startDate.length === 10
            ? options.startDate + "T12:00:00"
            : options.startDate,
        )
      : options.startDate
    : undefined;

  const baseOpts = {
    days,
    startDate,
    changes: options?.changes,
    zoneGreenMin: profile.zoneGreenMin ?? 50000,
    zoneRedMax: profile.zoneRedMax ?? -50000,
    useExpectedData: options?.useExpectedData,
    usePatterns: options?.usePatterns ?? true,
    patternLookbackMonths: options?.patternLookbackMonths ?? 12,
  };

  if (options?.returnBoth) {
    const [forecastRes, forecastFactOnly] = await Promise.all([
      computeForecast(profileId, { ...baseOpts, useActualData: true }),
      computeForecastActualOnly(profileId, { days, startDate }),
    ]);
    return {
      forecast: forecastRes.forecast,
      forecastExpected: forecastRes.forecast,
      forecastFactOnly,
      zoneGreenMin: profile.zoneGreenMin ?? 50000,
      zoneRedMax: profile.zoneRedMax ?? -50000,
      usedPatterns: forecastRes.usedPatterns,
      hasEnoughPatternData: forecastRes.hasEnoughPatternData,
    };
  }

  const forecastRes = await computeForecast(profileId, {
    ...baseOpts,
    useActualData: options?.useActualData,
  });
  return {
    forecast: forecastRes.forecast,
    zoneGreenMin: profile.zoneGreenMin ?? 50000,
    zoneRedMax: profile.zoneRedMax ?? -50000,
    usedPatterns: forecastRes.usedPatterns,
    hasEnoughPatternData: forecastRes.hasEnoughPatternData,
  };
}
