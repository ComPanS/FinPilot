"use client";

import { useState } from "react";
import { createCheckoutAction } from "@/app/actions/billing";
import { PLANS } from "@/config/plans";

export function BillingPlans({
  currentPlan,
  userId,
}: {
  currentPlan: string;
  userId: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    if (planId === "FREE" || planId === currentPlan) return;
    setLoading(planId);
    try {
      const res = await createCheckoutAction(userId, planId);
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
    <div className="grid gap-6 md:grid-cols-3">
      {Object.entries(PLANS).map(([id, plan]) => (
        <div
          key={id}
          className={`rounded-xl border p-6 ${
            currentPlan === id
              ? "border-primary bg-primary/5"
              : "border-border bg-surface"
          }`}
        >
          <h3 className="font-semibold text-foreground">{plan.name}</h3>
          <p className="mt-2 text-2xl font-bold">{plan.priceLabel}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {plan.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade(id)}
            disabled={id === "FREE" || id === currentPlan || !!loading}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading === id ? "..." : id === currentPlan ? "Текущий" : "Выбрать"}
          </button>
        </div>
      ))}
    </div>
  );
}
