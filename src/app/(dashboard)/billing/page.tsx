import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BillingPlans } from "@/components/billing/billing-plans";
import { CancelSubscriptionButton } from "@/components/billing/cancel-subscription-button";
import { getPlanConfig, getEffectivePlan } from "@/config/plans";
import { formatDateShortMSK } from "@/lib/date-utils";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });

  if (!user) redirect("/login");

  const planId = user.subscription?.plan ?? "FREE";
  const effective = getEffectivePlan(planId, user.subscription?.trialEndsAt);
  const planConfig = getPlanConfig(effective === "TRIAL" ? "PRO" : effective);
  const displayName = planConfig?.name ?? planId;
  const sub = user.subscription;
  const isPaidPlan = ["STANDARD", "PRO"].includes(planId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Тарифы</h1>
        <p className="mt-1 text-muted-foreground">
          Текущий план: {displayName}
          {effective === "TRIAL" && sub?.trialEndsAt && (
            <span className="ml-2 text-sm">
              (до {formatDateShortMSK(new Date(sub.trialEndsAt))})
            </span>
          )}
          {isPaidPlan && sub?.currentPeriodEnd && (
            <span className="ml-2 text-sm">
              Следующее списание: {formatDateShortMSK(new Date(sub.currentPeriodEnd))}
            </span>
          )}
        </p>
        {isPaidPlan && sub && !sub.cancelAtPeriodEnd && (
          <CancelSubscriptionButton
            userId={user.id}
            currentPeriodEnd={sub.currentPeriodEnd}
            className="mt-3"
          />
        )}
        {isPaidPlan && sub?.cancelAtPeriodEnd && sub?.currentPeriodEnd && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-500">
            Подписка отменена. Доступ до {formatDateShortMSK(new Date(sub.currentPeriodEnd))}. Деньги не возвращаются.
          </p>
        )}
      </div>
      <BillingPlans
        currentPlan={planId}
        userId={user.id}
        trialEndsAt={sub?.trialEndsAt}
        currentPeriodEnd={sub?.currentPeriodEnd}
      />
    </div>
  );
}
