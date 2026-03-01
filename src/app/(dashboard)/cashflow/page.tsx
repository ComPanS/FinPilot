import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CashFlowPlanner } from "@/components/cashflow/cashflow-planner";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Планировщик денежных потоков</h1>
        <p className="mt-1 text-muted-foreground">
          Профиль: {profile.name} • Прогноз на {forecastDays} дней
        </p>
      </div>
      <CashFlowPlanner
        profile={profile}
        categories={categories}
        forecastDays={forecastDays}
      />
    </div>
  );
}
