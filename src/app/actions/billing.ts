"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/providers/yookassa";
import { PLANS, BILLABLE_PLANS } from "@/config/plans";

export async function createCheckoutAction(
  userId: string,
  planId: string,
  billingPeriod: "monthly" | "yearly" = "monthly",
  returnBaseUrl?: string,
  options?: { trialEndsAt?: Date | null; currentPeriodEnd?: Date | null },
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.email !== session.user.email) {
    return { error: "Пользователь не найден" };
  }

  if (!BILLABLE_PLANS.includes(planId as (typeof BILLABLE_PLANS)[number])) {
    return { error: "Неверный тариф" };
  }

  const plan = PLANS[planId];
  if (!plan) return { error: "Неверный тариф" };

  const amount = billingPeriod === "yearly" ? plan.priceYear : plan.price;
  if (amount <= 0) return { error: "Неверный тариф" };

  const baseUrl =
    returnBaseUrl ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  try {
    const returnUrl = `${baseUrl.replace(/\/$/, "")}/billing?success=1`;
    console.log("[billing] Creating checkout", {
      userId,
      planId,
      billingPeriod,
      amount,
      returnUrl,
      baseUrlSource: returnBaseUrl ? "client" : process.env.APP_URL ? "APP_URL" : process.env.NEXTAUTH_URL ? "NEXTAUTH_URL" : "default",
    });

    const metadata: Record<string, string> = { userId, planId, billingPeriod };
    if (options?.trialEndsAt) metadata.trialEndsAt = options.trialEndsAt.toISOString();
    if (options?.currentPeriodEnd) metadata.currentPeriodEnd = options.currentPeriodEnd.toISOString();

    const payment = await createPayment({
      amount,
      description: `ФинПланер ${plan.name} (${billingPeriod === "yearly" ? "год" : "мес"})`,
      returnUrl,
      metadata,
    });

    const confirmationUrl = (
      payment as { confirmation?: { confirmation_url?: string } }
    )?.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      console.error("[billing] No confirmation_url in payment response", payment);
      return { error: "Не удалось создать платёж" };
    }

    console.log("[billing] Checkout created, redirecting to YooKassa");
    return { url: confirmationUrl };
  } catch (e) {
    console.error("[billing] YooKassa error:", e);
    return { error: "Ошибка создания платежа" };
  }
}

export async function cancelSubscriptionAction(userId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user || user.email !== session.user.email) {
    return { error: "Пользователь не найден" };
  }

  const sub = user.subscription;
  if (!sub || !["STANDARD", "PRO"].includes(sub.plan)) {
    return { error: "Нет активной подписки для отмены" };
  }
  if (sub.cancelAtPeriodEnd) {
    return { error: "Подписка уже отменена" };
  }

  await prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
  });
  return { success: true };
}
