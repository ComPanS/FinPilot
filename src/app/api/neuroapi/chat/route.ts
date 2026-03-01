import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { askNeuro } from "@/lib/neuroapi";
import { checkAIQuota, createAIRequest } from "@/lib/services/ai";
import { computeForecast, getRedZones } from "@/lib/services/forecast";

export async function POST(req: Request) {
  try {
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

    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
    }

    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Лимит ИИ-запросов исчерпан. Доступно: ${quota.remaining} сегодня.` },
        { status: 429 }
      );
    }

    const profile = user.profiles[0];
    let context: Parameters<typeof askNeuro>[1] = {};

    if (profile) {
      const forecast = await computeForecast(profile.id, {
        days: user.subscription?.plan === "FREE" ? 30 : 90,
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка ИИ" },
      { status: 500 }
    );
  }
}
