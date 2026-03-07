import { prisma } from "@/lib/prisma";
import { canAccessFeature, getEffectivePlan, getEffectiveLimits, AI_FAIR_USE_DAILY_CAP } from "@/config/plans";

export async function checkAIQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });
  const planId = sub?.plan ?? "FREE";
  const effective = getEffectivePlan(planId, sub?.trialEndsAt);
  const limits = getEffectiveLimits(planId, sub?.trialEndsAt);

  if (!canAccessFeature(effective, "canUseAIChat")) {
    return { allowed: false, remaining: 0 };
  }

  // Pro/Trial: fair-use cap (daily)
  if (effective === "PRO" || effective === "TRIAL") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await prisma.aIRequest.count({
      where: { userId, createdAt: { gte: today } },
    });
    const allowed = count < AI_FAIR_USE_DAILY_CAP;
    return {
      allowed,
      remaining: allowed ? -1 : 0,
    };
  }

  // Standard: 5 запросов в месяц
  if (limits.aiRequestsPerMonth > 0) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await prisma.aIRequest.count({
      where: { userId, createdAt: { gte: monthStart } },
    });
    const remaining = Math.max(0, limits.aiRequestsPerMonth - count);
    return {
      allowed: count < limits.aiRequestsPerMonth,
      remaining,
    };
  }

  return { allowed: true, remaining: -1 };
}

export async function createAIRequest(
  userId: string,
  prompt: string,
  response: string
) {
  await prisma.aIRequest.create({
    data: { userId, prompt, response },
  });
}
