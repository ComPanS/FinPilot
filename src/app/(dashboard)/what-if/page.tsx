import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { getEffectiveLimits } from "@/config/plans";
import { WhatIfSimulator } from "@/components/what-if/what-if-simulator-dynamic";

type SerializedProfile = {
  id: string;
  regularExpenses: Array<{ id: string; name: string; amount: number; frequency: string; categoryId: string; category?: { id: string; name: string } }>;
  regularIncomes: Array<{ id: string; name: string; amount?: number; avgCheck?: number; taxes?: number; frequency: string; categoryId?: string; category?: { id: string; name: string } }>;
  manualTransactions: Array<{ id: string; date: string; type: "IN" | "OUT"; amount: number; description?: string; expenseCategoryId?: string; incomeCategoryId?: string }>;
};

function serializeProfile(profile: {
  id: string;
  regularExpenses: Array<{ id: string; name: string; amount: unknown; frequency: string; categoryId: string; category?: { id: string; name: string } | null }>;
  regularIncomes: Array<{ id: string; name: string; amount?: unknown; avgCheck?: unknown; taxes?: unknown; frequency: string; categoryId?: string | null; category?: { id: string; name: string } | null }>;
  manualTransactions: Array<{ id: string; date: Date | string; type: string; amount: unknown; description?: string | null; expenseCategoryId?: string | null; incomeCategoryId?: string | null; taxes?: unknown }>;
}): SerializedProfile {
  return {
    id: profile.id,
    regularExpenses: profile.regularExpenses.map((e) => ({
      id: e.id,
      name: e.name,
      amount: Number(e.amount),
      frequency: e.frequency,
      categoryId: e.categoryId,
      category: e.category ? { id: e.category.id, name: e.category.name } : undefined,
    })),
    regularIncomes: profile.regularIncomes.map((i) => ({
      id: i.id,
      name: i.name,
      amount: i.amount != null ? Number(i.amount) : undefined,
      avgCheck: i.avgCheck != null ? Number(i.avgCheck) : undefined,
      taxes: i.taxes != null ? Number(i.taxes) : undefined,
      frequency: i.frequency,
      categoryId: i.categoryId ?? undefined,
      category: i.category ? { id: i.category.id, name: i.category.name } : undefined,
    })),
    manualTransactions: profile.manualTransactions.map((t) => {
      const d = t.date;
      const dateStr = typeof d === "string" ? d.slice(0, 10) : d instanceof Date ? d.toISOString().slice(0, 10) : "";
      return {
        id: t.id,
        date: dateStr,
        type: t.type as "IN" | "OUT",
        amount: Number(t.amount),
        description: t.description ?? undefined,
        expenseCategoryId: t.expenseCategoryId ?? undefined,
        incomeCategoryId: t.incomeCategoryId ?? undefined,
      };
    }),
  };
}

export default async function WhatIfPage() {
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

  const limits = getEffectiveLimits(user.subscription?.plan, user.subscription?.trialEndsAt);

  const [scenarios, expenseCategories, incomeCategories] = await Promise.all([
    prisma.whatIfScenario.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: limits.whatIfScenarios,
    }),
    prisma.expenseCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
    prisma.incomeCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
    }),
  ]);

  const serializedProfile = serializeProfile(profile);

  return (
    <div className="space-y-8" data-tour-id="what-if-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Режим «Что если»</h1>
        <p className="mt-1 text-muted-foreground">
          Симулируйте изменения и смотрите, как изменится прогноз
        </p>
      </div>
      <WhatIfSimulator
        profile={serializedProfile}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        scenarios={scenarios}
        currency={profile.currency}
        scenarioLimit={limits.whatIfScenarios}
      />
    </div>
  );
}
