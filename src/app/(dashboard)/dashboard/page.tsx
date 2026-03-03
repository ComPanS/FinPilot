import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getForecastAction } from "@/app/actions/forecast";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { ForecastDebug } from "@/components/dashboard/forecast-debug";
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
        },
      },
      subscription: true,
    },
  });

  if (!user) redirect("/login");

  const profile = user.profiles[0];
  if (!profile) {
    redirect("/onboarding");
  }

  const now = new Date();
  // Нынешние: текущий календарный месяц с 1-го числа
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = lastOfMonth.getDate();
  const forecastRes = await getForecastAction(profile.id, {
    startDate: firstOfMonth,
    days: daysInMonth,
    useExpectedData: true,
  });
  const forecastData = forecastRes?.forecast ?? [];

  // Ожидаемые: следующие 2 календарных месяца с учётом user-entered expectedData
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0); // последний день 2-го месяца
  const expectedDays = Math.ceil((expectedEnd.getTime() - nextMonth.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const expectedForecastRes = await getForecastAction(profile.id, {
    days: Math.max(90, expectedDays + 30),
    useExpectedData: true,
  });
  const fullExpectedForecast = expectedForecastRes?.forecast ?? [];
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthAfterStr = `${monthAfterNext.getFullYear()}-${String(monthAfterNext.getMonth() + 1).padStart(2, "0")}`;

  const rawMonth1Data = fullExpectedForecast.filter((d) => d.date.startsWith(nextMonthStr));
  const rawMonth2Data = fullExpectedForecast.filter((d) => d.date.startsWith(monthAfterStr));

  // Нормализуем баланс: каждый месяц начинается с 0 (убираем перенос с прошлого месяца)
  const normalizeBalanceFromZero = (data: { date: string; balance: number; inflows: number; outflows: number }[]) => {
    if (data.length === 0) return data;
    const balanceAtStart = data[0].balance - data[0].inflows + data[0].outflows;
    return data.map((d) => ({ ...d, balance: d.balance - balanceAtStart }));
  };
  const expectedMonth1Data = normalizeBalanceFromZero(rawMonth1Data);
  const expectedMonth2Data = normalizeBalanceFromZero(rawMonth2Data);

  const month1Label = nextMonth.toLocaleDateString("ru", { month: "long", year: "numeric" });
  const month2Label = monthAfterNext.toLocaleDateString("ru", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <IncomeLogger incomes={profile.regularIncomes.map((i) => ({ id: i.id, name: i.name, amount: i.amount != null ? Number(i.amount) : undefined, avgCheck: i.avgCheck != null ? Number(i.avgCheck) : undefined, frequency: i.frequency, taxes: i.taxes != null ? Number(i.taxes) : undefined }))} />
      <ForecastDebug profileId={profile.id} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Добро пожаловать, {user.name ?? user.businessName ?? "Пользователь"}!
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Нынешние</h2>
        {forecastData.length > 0 ? (
          <DashboardCharts data={forecastData} currency={profile.currency} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Нет данных для прогноза. Добавьте расходы и доходы в планировщике.
          </p>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Ожидаемые (следующие 2 месяца)</h2>
        {expectedMonth1Data.length > 0 || expectedMonth2Data.length > 0 ? (
          <div className="space-y-8">
            {expectedMonth1Data.length > 0 && (
              <div>
                <h3 className="mb-4 text-base font-medium text-foreground capitalize">{month1Label}</h3>
                <DashboardCharts data={expectedMonth1Data} currency={profile.currency} />
              </div>
            )}
            {expectedMonth2Data.length > 0 && (
              <div>
                <h3 className="mb-4 text-base font-medium text-foreground capitalize">{month2Label}</h3>
                <DashboardCharts data={expectedMonth2Data} currency={profile.currency} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Нет данных для прогноза. Добавьте расходы и доходы в планировщике. Введите ожидаемые данные при добавлении, чтобы предвидеть будущие прибыли и убытки.
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
