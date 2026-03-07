import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { askNeuro } from "@/lib/neuroapi";
import { checkAIQuota, createAIRequest } from "@/lib/services/ai";
import { computeForecast, getRedZones } from "@/lib/services/forecast";
import { aiChatLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { canUserUseAIChat } from "@/lib/plan-utils";
import { getEffectiveLimits } from "@/config/plans";

export async function POST(req: Request) {
  try {
    const { success } = await aiChatLimiter.limit(getClientIdentifier(req.headers));
    if (!success) {
      return NextResponse.json(
        { error: "Слишком много запросов. Подождите минуту." },
        { status: 429 }
      );
    }
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { profiles: true, subscription: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const profile = getActiveProfile(user, cookieStore);

    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
    }

    if (!canUserUseAIChat(user.subscription)) {
      return NextResponse.json(
        { error: "ИИ-ассистент доступен в тарифах Standard и Pro. Перейдите на платный тариф для доступа." },
        { status: 403 }
      );
    }

    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      const limits = getEffectiveLimits(user.subscription?.plan, user.subscription?.trialEndsAt);
      const isMonthlyLimit = limits.aiRequestsPerMonth > 0;
      const msg = isMonthlyLimit
        ? (quota.remaining === 0
            ? "Лимит ИИ-запросов (5/мес) исчерпан. Попробуйте в следующем месяце или перейдите на Pro для безлимита."
            : `Лимит ИИ-запросов исчерпан. Доступно: ${quota.remaining} в этом месяце.`)
        : "Лимит ИИ-запросов исчерпан. Попробуйте завтра.";
      return NextResponse.json({ error: msg }, { status: 429 });
    }

    const limits = getEffectiveLimits(user.subscription?.plan, user.subscription?.trialEndsAt);

    let context: Parameters<typeof askNeuro>[1] = {};

    if (profile) {
      const { forecast } = await computeForecast(profile.id, {
        days: limits.forecastDays,
      });
      const redZones = getRedZones(forecast);
      const expenses = await prisma.regularExpense.findMany({
        where: { profileId: profile.id },
        include: { category: true },
      });
      const incomes = await prisma.regularIncome.findMany({
        where: { profileId: profile.id },
      });
      context = {
        forecast: forecast.slice(0, 30),
        redZones: redZones.slice(0, 10),
        expenses: expenses.map((e) => ({
          name: e.name,
          amount: Number(e.amount),
          frequency: e.frequency,
        })),
        incomes: incomes.map((i) => ({
          name: i.name,
          avgCheck: Number(i.avgCheck),
        })),
      };
    }

    const response = await askNeuro(prompt, context);
    await createAIRequest(user.id, prompt, response);

    return NextResponse.json({ response });
  } catch (e) {
    console.error("AI chat error:", e);
    return NextResponse.json({ error: "Ошибка ИИ" }, { status: 500 });
  }
}
