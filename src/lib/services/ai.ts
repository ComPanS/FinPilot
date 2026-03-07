import { prisma } from "@/lib/prisma";
import { canAccessFeature, getEffectivePlan, AI_FAIR_USE_DAILY_CAP } from "@/config/plans";

export async function checkAIQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });
  const planId = sub?.plan ?? "FREE";
  const effective = getEffectivePlan(planId, sub?.trialEndsAt);

  if (!canAccessFeature(effective, "canUseAIChat")) {
    return { allowed: false, remaining: 0 };
  }

  // Pro/Trial: fair-use cap
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
