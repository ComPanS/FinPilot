import type { Subscription } from "@prisma/client";
import {
  getEffectivePlan,
  canAccessFeature,
  getEffectiveLimits,
  type PlanLimits,
} from "@/config/plans";

export type SubscriptionLike = Pick<Subscription, "plan" | "trialEndsAt"> | null;

export type UserPlanContext = {
  planId: string;
  trialEndsAt: Date | null;
  limits: PlanLimits;
};

export function getUserPlanContext(subscription: SubscriptionLike): UserPlanContext {
  const planId = subscription?.plan ?? "FREE";
  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const effective = getEffectivePlan(planId, trialEndsAt);
  const limits = getEffectiveLimits(planId, trialEndsAt);

  return {
    planId: effective,
    trialEndsAt,
    limits,
  };
}

export function canUserExportReports(subscription: SubscriptionLike): boolean {
  const planId = subscription?.plan ?? "FREE";
  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const effective = getEffectivePlan(planId, trialEndsAt);
  return canAccessFeature(effective, "canExportReports");
}

export function canUserUseAIChat(subscription: SubscriptionLike): boolean {
  const planId = subscription?.plan ?? "FREE";
  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const effective = getEffectivePlan(planId, trialEndsAt);
  return canAccessFeature(effective, "canUseAIChat");
}

export function getReportExportLimit(planId: string, trialEndsAt?: Date | null): number {
  const limits = getEffectiveLimits(planId, trialEndsAt ?? null);
  return limits.reportExportsPerMonth;
}
