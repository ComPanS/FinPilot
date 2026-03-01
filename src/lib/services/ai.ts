import { prisma } from "@/lib/prisma";
import { askNeuro } from "@/lib/neuroapi";

const FREE_AI_LIMIT = 5;

export async function checkAIQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (sub && sub.plan !== "FREE") {
    return { allowed: true, remaining: -1 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await prisma.aIRequest.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });
  return {
    allowed: count < FREE_AI_LIMIT,
    remaining: Math.max(0, FREE_AI_LIMIT - count),
  };
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
