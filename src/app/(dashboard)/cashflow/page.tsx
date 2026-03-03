import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { CashFlowPlanner } from "@/components/cashflow/cashflow-planner";

export const dynamic = "force-dynamic";

function serializeProfile<T extends {
  regularExpenses: { amount: unknown }[];
  regularIncomes: { amount?: unknown; avgCheck?: unknown; taxes?: unknown; salesPlan?: unknown }[];
  manualTransactions: { amount: unknown; taxes?: unknown }[];
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
      taxes: i.taxes != null ? Number(i.taxes) : undefined,
      salesPlan: i.salesPlan,
    })),
    manualTransactions: profile.manualTransactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      taxes: (t as { taxes?: unknown }).taxes != null ? Number((t as { taxes?: unknown }).taxes) : undefined,
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
          regularIncomes: { include: { category: true } },
          manualTransactions: { include: { expenseCategory: true, incomeCategory: true } },
        },
      },
      subscription: true,
    },
  });

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const profile = getActiveProfile(user, cookieStore);
  if (!profile) redirect("/onboarding");

  const [expenseCategories, incomeCategories] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
    prisma.incomeCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
  ]);

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
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        forecastDays={forecastDays}
        userId={user.id}
      />
    </div>
  );
}
