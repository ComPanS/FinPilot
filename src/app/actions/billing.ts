"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/providers/yookassa";
import { PLANS } from "@/config/plans";

export async function createCheckoutAction(userId: string, planId: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.email !== session.user.email) {
    return { error: "Пользователь не найден" };
  }

  if (planId === "FREE") return { error: "Нельзя оформить бесплатный план" };

  const plan = PLANS[planId as keyof typeof PLANS];
  if (!plan || plan.price <= 0) return { error: "Неверный тариф" };

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const payment = await createPayment({
      amount: plan.price,
      description: `ФинПилот ${plan.name}`,
      returnUrl: `${baseUrl}/billing?success=1`,
      metadata: { userId, planId },
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
