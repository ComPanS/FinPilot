import { prisma } from "@/lib/prisma";
import { createRecurringPayment } from "@/lib/providers/yookassa";
import { PLANS, BILLABLE_PLANS } from "@/config/plans";

export interface RenewResult {
  renewed: string[];
  expired: string[];
  errors: string[];
}

/** Renew subscriptions due in the next 3 days or past due up to 7 days. Expire canceled subscriptions past period end. */
export async function runRenewSubscriptions(): Promise<RenewResult> {
  const now = new Date();
  const inThreeDays = new Date(now);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const renewed: string[] = [];
  const expired: string[] = [];
  const errors: string[] = [];

  const toExpire = await prisma.subscription.findMany({
    where: {
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lte: now },
    },
  });
  for (const sub of toExpire) {
    await prisma.subscription.update({
      where: { userId: sub.userId },
      data: {
        plan: "FREE",
        status: "active",
        cancelAtPeriodEnd: false,
        billingPeriod: null,
        currentPeriodEnd: null,
        yookassaPaymentMethodId: null,
      },
    });
    expired.push(sub.userId);
  }

  const toRenew = await prisma.subscription.findMany({
    where: {
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { gte: sevenDaysAgo, lte: inThreeDays },
      yookassaPaymentMethodId: { not: null },
      plan: { in: BILLABLE_PLANS },
    },
  });

  for (const sub of toRenew) {
    const plan = PLANS[sub.plan];
    const billingPeriod = (sub.billingPeriod ?? "monthly") as "monthly" | "yearly";
    const amount = billingPeriod === "yearly" ? (plan?.priceYear ?? 0) : (plan?.price ?? 0);
    if (!plan || amount <= 0) {
      errors.push(`Invalid plan ${sub.plan} for user ${sub.userId}`);
      continue;
    }
    try {
      await createRecurringPayment({
        paymentMethodId: sub.yookassaPaymentMethodId!,
        amount,
        description: `ФинПланер ${plan.name} (${billingPeriod === "yearly" ? "год" : "мес"}) — продление`,
        metadata: { userId: sub.userId, planId: sub.plan, billingPeriod },
      });
      renewed.push(sub.userId);
    } catch (e) {
      errors.push(`${sub.userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { renewed, expired, errors };
}

export interface SubscriptionWithDate {
  userId: string;
  email: string | null;
  plan: string;
  billingPeriod: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasPaymentMethod: boolean;
}

/** Список платных подписок с датами списания (для отладки) */
export async function getSubscriptionsWithDates(): Promise<SubscriptionWithDate[]> {
  const subs = await prisma.subscription.findMany({
    where: { plan: { in: BILLABLE_PLANS } },
    include: { user: { select: { email: true } } },
    orderBy: { currentPeriodEnd: "asc" },
  });
  return subs.map((s) => ({
    userId: s.userId,
    email: s.user.email,
    plan: s.plan,
    billingPeriod: s.billingPeriod,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    hasPaymentMethod: !!s.yookassaPaymentMethodId,
  }));
}
