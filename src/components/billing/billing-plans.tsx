"use client";

import { useState } from "react";
import { createCheckoutAction } from "@/app/actions/billing";
import { PLANS, BILLABLE_PLANS } from "@/config/plans";

const DISPLAY_PLANS = ["FREE", "STANDARD", "PRO"] as const;

export function BillingPlans({
  currentPlan,
  userId,
  trialEndsAt,
  currentPeriodEnd,
}: {
  currentPlan: string;
  userId: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const isTrialActive = currentPlan === "TRIAL" && trialEndsAt && new Date(trialEndsAt) > new Date();
  const isPaidPlan = ["STANDARD", "PRO"].includes(currentPlan);
  const isYearlyUpgrade =
    isPaidPlan && billingPeriod === "yearly" && currentPlan !== "TRIAL";

  const canPurchase = (planId: string) => {
    if (!BILLABLE_PLANS.includes(planId as (typeof BILLABLE_PLANS)[number])) return false;
    if (planId !== currentPlan) return true;
    if (isTrialActive && planId === "PRO") return true;
    if (planId === currentPlan && billingPeriod === "yearly" && isPaidPlan) return true;
    return false;
  };

  const handleUpgrade = async (planId: string) => {
    if (!canPurchase(planId)) return;
    setLoading(planId);
    try {
      const options: { trialEndsAt?: Date | null; currentPeriodEnd?: Date | null } = {};
      if (isTrialActive && planId === "PRO" && trialEndsAt) options.trialEndsAt = trialEndsAt;
      if (isYearlyUpgrade && currentPeriodEnd && planId === currentPlan) options.currentPeriodEnd = currentPeriodEnd;

      const res = await createCheckoutAction(
        userId,
        planId,
        billingPeriod,
        typeof window !== "undefined" ? window.location.origin : undefined,
        Object.keys(options).length > 0 ? options : undefined,
      );
      if (res?.error) {
        alert(res.error);
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {isTrialActive && (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          При покупке Pro во время триала следующее списание будет через 1 месяц (или 1 год) после окончания пробного периода.
        </p>
      )}
      {BILLABLE_PLANS.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Период оплаты:</span>
          <div className="flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                billingPeriod === "monthly" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ежемесячно
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("yearly")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                billingPeriod === "yearly" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Годовой (2 мес в подарок)
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {DISPLAY_PLANS.map((id) => {
          const plan = PLANS[id];
          if (!plan) return null;

          const isCurrent = currentPlan === id || (id === "PRO" && isTrialActive);
          const isBillable = BILLABLE_PLANS.includes(id as (typeof BILLABLE_PLANS)[number]);
          const canBuy = canPurchase(id);
          const priceLabel =
            billingPeriod === "yearly" && plan.priceYear > 0
              ? plan.priceYearLabel
              : plan.priceLabel;
          const showSavings = billingPeriod === "yearly" && plan.yearlySavingsPercent > 0;

          return (
            <div
              key={id}
              className={`rounded-xl border p-6 ${
                isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
            >
              {isTrialActive && id === "PRO" && (
                <span className="mb-2 inline-block rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  Пробный период
                </span>
              )}
              <h3 className="font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold">{priceLabel}</p>
              {showSavings && (
                <p className="mt-1 text-sm text-success">Экономия {plan.yearlySavingsPercent}%</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.featuresList.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(id)}
                disabled={!canBuy || !!loading}
                className="mt-6 w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-default"
              >
                {loading === id ? "..." : canBuy ? "Выбрать" : !isBillable ? "Бесплатно" : "Текущий"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
