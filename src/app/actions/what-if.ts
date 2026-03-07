"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getEffectiveLimits } from "@/config/plans";
import type { WhatIfChanges } from "@/types";

export async function saveScenarioAction(
  profileId: string,
  name: string,
  changes: WhatIfChanges
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

  const limits = getEffectiveLimits(user.subscription?.plan, user.subscription?.trialEndsAt);
  const count = await prisma.whatIfScenario.count({
    where: { profileId },
  });
  if (count >= limits.whatIfScenarios) {
    return { error: `Максимум ${limits.whatIfScenarios} сценариев на вашем тарифе` };
  }

  await prisma.whatIfScenario.create({
    data: {
      profileId,
      name,
      changesJson: changes as object,
    },
  });
  revalidatePath("/what-if");
  return { success: true };
}

export async function deleteScenarioAction(id: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const scenario = await prisma.whatIfScenario.findFirst({
    where: { id },
    include: { profile: { include: { user: true } } },
  });
  if (!scenario || scenario.profile.user.email !== session.user.email) {
    return { error: "Не найдено" };
  }

  await prisma.whatIfScenario.delete({ where: { id } });
  revalidatePath("/what-if");
  return { success: true };
}
