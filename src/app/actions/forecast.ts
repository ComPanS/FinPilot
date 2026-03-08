"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveLimits } from "@/config/plans";
import { computeForecast, computeForecastActualOnly } from "@/lib/services/forecast";
import type { WhatIfChanges } from "@/types";

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
  const limits = getEffectiveLimits(user.subscription?.plan, user.subscription?.trialEndsAt);
  const days = options?.days ?? limits.forecastDays;
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
    const forecastRes = await computeForecast(profileId, {
      ...baseOpts,
      useActualData: true,
    });
    const forecastFactOnly = await computeForecastActualOnly(profileId, {
      days,
      startDate,
      forecast: forecastRes.forecast,
    });
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

export type HalfYearChartPoint = {
  month: string;
  monthLabel: string;
  inflows: number;
  outflows: number;
  profit: number;
  type: "fact" | "expected";
};

export async function getHalfYearChartDataAction(
  profileId: string,
): Promise<{ error?: string; data?: HalfYearChartPoint[] }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const [forecastRes, monthlyDataRows] = await Promise.all([
    getForecastAction(profileId, {
      startDate: startDateStr,
      days: 365,
      useExpectedData: true,
      returnBoth: true,
    }),
    prisma.profileMonthlyData.findMany({
      where: { profileId },
      select: { month: true, income: true, expense: true },
    }),
  ]);

  const forecastExpected = forecastRes?.forecastExpected ?? [];
  const forecastFactOnly = forecastRes?.forecastFactOnly ?? [];

  const monthlyDataByMonth = new Map(
    monthlyDataRows.map((m) => [
      m.month,
      { inflows: Number(m.income), outflows: Number(m.expense) },
    ]),
  );

  // inflows = income only (regular + one-time IN). outflows = expense only (regular + one-time OUT).
  const aggregateByMonth = (
    dailyData: { date: string; inflows?: number | null; outflows?: number | null; hasFactData?: boolean }[],
    useFactOnly: boolean,
  ): Map<string, { inflows: number; outflows: number }> => {
    const byMonth = new Map<string, { inflows: number; outflows: number }>();
    for (const d of dailyData) {
      const monthKey = d.date.substring(0, 7);
      if (useFactOnly && !d.hasFactData) continue;
      const curr = byMonth.get(monthKey) ?? { inflows: 0, outflows: 0 };
      curr.inflows += d.inflows ?? 0;
      curr.outflows += d.outflows ?? 0;
      byMonth.set(monthKey, curr);
    }
    return byMonth;
  };

  const factByMonth = aggregateByMonth(forecastFactOnly, true);
  const expectedByMonth = aggregateByMonth(
    forecastExpected.map((d) => ({ ...d, hasFactData: false })),
    false,
  );

  const result: HalfYearChartPoint[] = [];
  const monthNames = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];

  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const factData = factByMonth.get(monthKey);
    const monthlyData = monthlyDataByMonth.get(monthKey);
    const data = factData != null ? factData : (monthlyData ?? { inflows: 0, outflows: 0 });
    const profit = Math.round(data.inflows - data.outflows);
    result.push({
      month: monthKey,
      monthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      inflows: Math.round(data.inflows),
      outflows: Math.round(data.outflows),
      profit,
      type: "fact",
    });
  }

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const exp = expectedByMonth.get(monthKey) ?? { inflows: 0, outflows: 0 };
    const profit = Math.round(exp.inflows - exp.outflows);
    result.push({
      month: monthKey,
      monthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      inflows: Math.round(exp.inflows),
      outflows: Math.round(exp.outflows),
      profit,
      type: "expected",
    });
  }

  return { data: result };
}
