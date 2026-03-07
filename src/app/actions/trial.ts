"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Запустить 14-дневный пробный период Pro */
export async function startTrialAction() {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });
  if (!user) return { error: "Пользователь не найден" };

  if (user.trialUsedAt) {
    return { error: "Пробный период уже использован" };
  }

  const sub = user.subscription;
  if (sub && sub.plan !== "FREE" && sub.plan !== "TRIAL") {
    return { error: "У вас уже активная подписка" };
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { trialUsedAt: new Date() },
    }),
    prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: "TRIAL",
        status: "active",
        trialEndsAt,
      },
      update: {
        plan: "TRIAL",
        status: "active",
        trialEndsAt,
      },
    }),
  ]);

  return { success: true, trialEndsAt };
}

/** Автоматически запустить пробный период, если пользователь на FREE и ещё не использовал */
export async function startTrialIfEligible(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user || user.trialUsedAt) return;

  const sub = user.subscription;
  if (sub && sub.plan !== "FREE" && sub.plan !== "TRIAL") return;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { trialUsedAt: new Date() },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: "TRIAL",
        status: "active",
        trialEndsAt,
      },
      update: {
        plan: "TRIAL",
        status: "active",
        trialEndsAt,
      },
    }),
  ]);
}

/** Истечь триал в БД если trialEndsAt прошло */
export async function expireTrialIfNeeded(userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (!sub || sub.plan !== "TRIAL") return;

  const now = new Date();
  if (sub.trialEndsAt && sub.trialEndsAt <= now) {
    await prisma.subscription.update({
      where: { userId },
      data: { plan: "FREE", trialEndsAt: null },
    });
  }
}
