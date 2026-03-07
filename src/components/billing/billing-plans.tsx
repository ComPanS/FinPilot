"use client";

import { useState } from "react";
import { createCheckoutAction } from "@/app/actions/billing";
import { startTrialAction } from "@/app/actions/trial";
import { PLANS, BILLABLE_PLANS } from "@/config/plans";

const DISPLAY_PLANS = ["FREE", "STANDARD", "PRO"] as const;

export function BillingPlans({
  currentPlan,
  userId,
  trialEndsAt,
  trialUsed,
}: {
  currentPlan: string;
  userId: string;
  trialEndsAt?: Date | null;
  trialUsed?: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const isTrialActive = currentPlan === "TRIAL" && trialEndsAt && new Date(trialEndsAt) > new Date();

  const handleUpgrade = async (planId: string) => {
    if (!BILLABLE_PLANS.includes(planId as (typeof BILLABLE_PLANS)[number])) return;
    if (planId === currentPlan && !isTrialActive) return;
    setLoading(planId);
    try {
      const res = await createCheckoutAction(userId, planId, billingPeriod);
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

  const handleStartTrial = async () => {
    setLoading("TRIAL");
    try {
      const res = await startTrialAction();
      if (res?.error) {
        alert(res.error);
        return;
      }
      window.location.reload();
    } finally {
      setLoading(null);
    }
  };

  const canStartTrial = (currentPlan === "FREE" || isTrialActive) && !trialUsed;

  return (
    <div className="space-y-6">
      {canStartTrial && (
        <div className="rounded-xl border border-primary bg-primary/5 p-4">
          <p className="font-medium text-foreground">Попробуйте Pro бесплатно 14 дней</p>
          <p className="mt-1 text-sm text-muted-foreground">Без привязки карты. Полный функционал Pro.</p>
          <button
            onClick={handleStartTrial}
            disabled={!!loading}
            className="mt-3 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading === "TRIAL" ? "..." : "Начать пробный период"}
          </button>
        </div>
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
                disabled={!isBillable || isCurrent || !!loading}
                className="mt-6 w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === id
                  ? "..."
                  : isCurrent
                    ? "Текущий"
                    : isBillable
                      ? "Выбрать"
                      : "Бесплатно"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
