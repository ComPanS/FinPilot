import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import Link from "next/link";
import { getForecastAction } from "@/app/actions/forecast";
import { countDaysWithFactData } from "@/lib/services/fact-stats";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardCalculationLog } from "@/components/dashboard/dashboard-calculation-log";
import { IncomeLogger } from "@/components/dashboard/income-logger";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profiles: {
        include: {
          regularExpenses: true,
          regularIncomes: true,
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

  const now = new Date();
  // Нынешние: текущий календарный месяц с 1-го числа (строка YYYY-MM-DD для избежания timezone-сдвигов)
  const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const forecastRes = await getForecastAction(profile.id, {
    startDate: firstOfMonthStr,
    days: daysInMonth,
    useExpectedData: true,
    returnBoth: true,
  });
  const rawForecastExpected = forecastRes?.forecastExpected ?? [];
  const forecastFactOnly = "forecastFactOnly" in (forecastRes ?? {}) ? forecastRes.forecastFactOnly ?? [] : [];

  const normalizeBalanceFromZero = (data: { date: string; balance: number; inflows: number; outflows: number }[]) => {
    if (data.length === 0) return data;
    const balanceAtStart = data[0].balance - data[0].inflows + data[0].outflows;
    return data.map((d) => ({ ...d, balance: d.balance - balanceAtStart }));
  };
  const forecastExpected = normalizeBalanceFromZero(rawForecastExpected);

  const balanceAtStart =
    rawForecastExpected.length > 0
      ? rawForecastExpected[0].balance - rawForecastExpected[0].inflows + rawForecastExpected[0].outflows
      : 0;
  const forecastFactOnlyNormalized = forecastFactOnly.map((d) =>
    d.hasFactData && d.balance != null
      ? { ...d, balance: d.balance - balanceAtStart }
      : d,
  );

  // Проверяем, ввёл ли пользователь хотя бы одну ожидаемую сумму, данные по месяцам или 10+ дней факта
  const hasEntityExpectedData = [
    ...profile.regularExpenses,
    ...profile.regularIncomes,
  ].some((e) => {
    const ed = (e as { expectedData?: Record<string, number> | null }).expectedData;
    return ed && typeof ed === "object" && Object.keys(ed).length > 0;
  });
  const hasMonthlyData = ((profile as { monthlyData?: unknown[] }).monthlyData?.length ?? 0) > 0;
  const hasAtLeast10DaysOfFact = (await countDaysWithFactData(profile.id)) >= 10;
  const hasAnyExpectedData = hasEntityExpectedData || hasMonthlyData || hasAtLeast10DaysOfFact;

  let expectedMonth1Expected: { date: string; balance: number; inflows: number; outflows: number }[] = [];
  let expectedMonth2Expected: { date: string; balance: number; inflows: number; outflows: number }[] = [];
  let month1Label = "";
  let month2Label = "";
  let expectedForecastRes: Awaited<ReturnType<typeof getForecastAction>> | null = null;

  if (hasAnyExpectedData) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const expectedDays = Math.ceil((expectedEnd.getTime() - nextMonth.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    expectedForecastRes = await getForecastAction(profile.id, {
      days: Math.max(90, expectedDays + 30),
      useExpectedData: true,
      returnBoth: true,
    });
    const fullExpectedForecastExpected = expectedForecastRes?.forecastExpected ?? [];
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthAfterStr = `${monthAfterNext.getFullYear()}-${String(monthAfterNext.getMonth() + 1).padStart(2, "0")}`;

    const rawMonth1Expected = fullExpectedForecastExpected.filter((d) => d.date.startsWith(nextMonthStr));
    const rawMonth2Expected = fullExpectedForecastExpected.filter((d) => d.date.startsWith(monthAfterStr));

    const normalizeBalanceFromZero = (data: { date: string; balance: number; inflows: number; outflows: number }[]) => {
      if (data.length === 0) return data;
      const balanceAtStart = data[0].balance - data[0].inflows + data[0].outflows;
      return data.map((d) => ({ ...d, balance: d.balance - balanceAtStart }));
    };
    expectedMonth1Expected = normalizeBalanceFromZero(rawMonth1Expected);
    expectedMonth2Expected = normalizeBalanceFromZero(rawMonth2Expected);
    month1Label = nextMonth.toLocaleDateString("ru", { month: "long", year: "numeric" });
    month2Label = monthAfterNext.toLocaleDateString("ru", { month: "long", year: "numeric" });
  }

  return (
    <div className="space-y-8">
      <IncomeLogger incomes={profile.regularIncomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount != null ? Number(i.amount) : undefined, avgCheck: i.avgCheck != null ? Number(i.avgCheck) : undefined, frequency: i.frequency, taxes: i.taxes != null ? Number(i.taxes) : undefined }))} />
      <DashboardCalculationLog profileId={profile.id} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Добро пожаловать, {user.name ?? profile.name ?? "Пользователь"}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Профиль: {profile.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Регулярные расходы
          </h3>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {profile.regularExpenses.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">
            Источники дохода
          </h3>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {profile.regularIncomes.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Тариф</h3>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {user.subscription?.plan ?? "FREE"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">
          Чем больше фактических данных вы введёте, тем точнее будет прогноз.
        </p>
      </div>

      <section className="space-y-4" data-tour-id="section-charts">
        <h2 className="text-lg font-semibold text-foreground">Нынешние</h2>
        {forecastExpected.length > 0 ? (
          <DashboardCharts
            dataExpected={forecastExpected}
            dataFact={forecastFactOnlyNormalized.length > 0 ? forecastFactOnlyNormalized : undefined}
            currency={profile.currency}
            section="Нынешние"
            showPatternHint
            usedPatterns={forecastRes?.usedPatterns}
            hasEnoughPatternData={forecastRes?.hasEnoughPatternData}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Нет данных для прогноза. Добавьте расходы и доходы в планировщике.
          </p>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Ожидаемые (следующие 2 месяца)</h2>
        {expectedMonth1Expected.length > 0 || expectedMonth2Expected.length > 0 ? (
          <div className="space-y-8">
            {expectedMonth1Expected.length > 0 && (
              <div>
                <h3 className="mb-4 text-base font-medium text-foreground capitalize">{month1Label}</h3>
                <DashboardCharts
                  dataExpected={expectedMonth1Expected}
                  currency={profile.currency}
                  section={month1Label}
                  showPatternHint
                  usedPatterns={expectedForecastRes?.usedPatterns}
                  hasEnoughPatternData={expectedForecastRes?.hasEnoughPatternData}
                />
              </div>
            )}
            {expectedMonth2Expected.length > 0 && (
              <div>
                <h3 className="mb-4 text-base font-medium text-foreground capitalize">{month2Label}</h3>
                <DashboardCharts
                  dataExpected={expectedMonth2Expected}
                  currency={profile.currency}
                  section={month2Label}
                  showPatternHint
                  usedPatterns={expectedForecastRes?.usedPatterns}
                  hasEnoughPatternData={expectedForecastRes?.hasEnoughPatternData}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasAnyExpectedData
              ? "Нет данных для прогноза. Добавьте расходы и доходы в планировщике."
              : "Введите хотя бы одну ожидаемую сумму в планировщике (в расходах или доходах) или заполните фактические данные минимум за 10 дней — тогда появятся ожидаемые данные на следующие месяцы. Чем больше данных — тем точнее прогноз."}
          </p>
        )}
      </section>

      <div className="flex gap-4">
        <Link
          href="/cashflow"
          className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
        >
          Открыть планировщик
        </Link>
        <Link
          href="/insights"
          className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface"
        >
          Спросить ИИ
        </Link>
      </div>
    </div>
  );
}
