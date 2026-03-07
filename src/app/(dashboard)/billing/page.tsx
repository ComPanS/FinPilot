import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BillingPlans } from "@/components/billing/billing-plans";
import { getPlanConfig, getEffectivePlan } from "@/config/plans";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Тарифы</h1>
        <p className="mt-1 text-muted-foreground">
          Текущий план: {displayName}
          {effective === "TRIAL" && user.subscription?.trialEndsAt && (
            <span className="ml-2 text-sm">
              (до {new Date(user.subscription.trialEndsAt).toLocaleDateString("ru-RU")})
            </span>
          )}
        </p>
      </div>
      <BillingPlans
        currentPlan={planId}
        userId={user.id}
        trialEndsAt={user.subscription?.trialEndsAt}
        trialUsed={!!user.trialUsedAt}
      />
    </div>
  );
}
