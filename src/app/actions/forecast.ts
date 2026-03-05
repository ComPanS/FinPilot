"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeForecast, computeForecastActualOnly, computeForecastDebug } from "@/lib/services/forecast";
import type { WhatIfChanges } from "@/types";

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
