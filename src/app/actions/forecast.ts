"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeForecast } from "@/lib/services/forecast";
import type { WhatIfChanges } from "@/types";

export async function getForecastAction(
  profileId: string,
  options?: { days?: number; changes?: WhatIfChanges }
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

  const days = user.subscription?.plan === "FREE" ? 30 : options?.days ?? 90;
  const forecast = await computeForecast(profileId, {
    days,
    changes: options?.changes,
  });
  return { forecast };
}
