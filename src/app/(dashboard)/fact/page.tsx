import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { FactPage } from "@/components/fact/fact-page";
import { getForecastAction } from "@/app/actions/forecast";

export const dynamic = "force-dynamic";

function serializeProfile<T extends {
  regularExpenses: { amount: unknown }[];
  regularIncomes: { amount?: unknown; avgCheck?: unknown }[];
  manualTransactions?: { amount: unknown; taxes?: unknown }[];
  monthlyData?: { month: string; income: unknown; expense: unknown }[];
}>(profile: T) {
  return {
    ...profile,
    regularExpenses: profile.regularExpenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    regularIncomes: profile.regularIncomes.map((i) => ({
      ...i,
      amount: i.amount != null ? Number(i.amount) : undefined,
      avgCheck: i.avgCheck != null ? Number(i.avgCheck) : undefined,
    })),
    manualTransactions: (profile.manualTransactions ?? []).map((t) => ({
      ...t,
      amount: Number(t.amount),
      taxes: (t as { taxes?: unknown }).taxes != null ? Number((t as { taxes?: unknown }).taxes) : undefined,
    })),
    monthlyData: (profile.monthlyData ?? []).map((m) => ({
      ...m,
      income: Number(m.income),
      expense: Number(m.expense),
    })),
  };
}

export default async function FactPageRoute() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profiles: {
        include: {
          regularExpenses: { include: { category: true } },
          regularIncomes: { include: { category: true } },
          manualTransactions: { include: { expenseCategory: true, incomeCategory: true } },
          monthlyData: true,
        },
      },
      subscription: true,
    },
  });

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const profile = getActiveProfile(user, cookieStore);
  if (!profile) redirect("/onboarding");

  const serializedProfile = serializeProfile(profile);

  const [expenseCategories, incomeCategories] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
    prisma.incomeCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
  ]);

  const forecastDays = user.subscription?.plan === "FREE" ? 30 : 90;
  const now = new Date();
  const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const forecastRes = await getForecastAction(profile.id, {
    startDate: firstOfMonthStr,
    days: Math.max(daysInMonth, forecastDays),
    useExpectedData: true,
    returnBoth: true,
  });
  const forecastFactOnly =
    "forecastFactOnly" in (forecastRes ?? {}) ? forecastRes.forecastFactOnly ?? [] : [];

  const zoneGreenMin = profile.zoneGreenMin ?? 50000;
  const zoneRedMax = profile.zoneRedMax ?? -50000;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Факт</h1>
        <p className="mt-1 text-muted-foreground">
          Профиль: {profile.name} • Ввод фактических значений для регулярных статей
        </p>
      </div>
      {/* <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">
          Чем больше фактических данных вы введёте, тем точнее будет прогноз.
        </p>
      </div> */}
      <FactPage
        profile={serializedProfile}
        currency={profile.currency}
        profileId={profile.id}
        userId={user.id}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        forecastFactOnly={forecastFactOnly}
        zoneGreenMin={zoneGreenMin}
        zoneRedMax={zoneRedMax}
      />
    </div>
  );
}
