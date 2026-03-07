"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/providers/yookassa";
import { PLANS, BILLABLE_PLANS } from "@/config/plans";

export async function createCheckoutAction(
  userId: string,
  planId: string,
  billingPeriod: "monthly" | "yearly" = "monthly"
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

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const payment = await createPayment({
      amount,
      description: `ФинПилот ${plan.name} (${billingPeriod === "yearly" ? "год" : "мес"})`,
      returnUrl: `${baseUrl}/billing?success=1`,
      metadata: { userId, planId, billingPeriod },
    });

    const confirmationUrl = (payment as { confirmation?: { confirmation_url?: string } })
      ?.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      return { error: "Не удалось создать платёж" };
    }

    return { url: confirmationUrl };
  } catch (e) {
    console.error("YooKassa error:", e);
    return { error: "Ошибка создания платежа" };
  }
}
