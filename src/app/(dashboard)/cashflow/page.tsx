import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CashFlowPlanner } from "@/components/cashflow/cashflow-planner";

function serializeProfile<T extends { regularExpenses: { amount: unknown }[]; regularIncomes: { avgCheck: unknown; salesPlan: unknown }[]; manualTransactions: { amount: unknown }[] }>(profile: T) {
  return {
    ...profile,
    regularExpenses: profile.regularExpenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    })),
    regularIncomes: profile.regularIncomes.map((i) => ({
      ...i,
      avgCheck: Number(i.avgCheck),
      salesPlan: i.salesPlan,
    })),
    manualTransactions: profile.manualTransactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    })),
  };
}

export default async function CashFlowPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profiles: {
        include: {
          regularExpenses: { include: { category: true } },
          regularIncomes: true,
          manualTransactions: true,
        },
      },
      subscription: true,
    },
  });

  if (!user) redirect("/login");
  const profile = user.profiles[0];
  if (!profile) redirect("/onboarding");

  const categories = await prisma.expenseCategory.findMany({
    where: { OR: [{ isSystem: true }, { userId: user.id }] },
  });

  const forecastDays = user.subscription?.plan === "FREE" ? 30 : 90;

  const serializedProfile = serializeProfile(profile);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Планировщик денежных потоков</h1>
        <p className="mt-1 text-muted-foreground">
          Профиль: {profile.name} • Прогноз на {forecastDays} дней
        </p>
      </div>
      <CashFlowPlanner
        profile={serializedProfile}
        categories={categories}
        forecastDays={forecastDays}
      />
    </div>
  );
}
