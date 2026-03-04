import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { FactPage } from "@/components/fact/fact-page";

export const dynamic = "force-dynamic";

function serializeProfile<T extends {
  regularExpenses: { amount: unknown }[];
  regularIncomes: { amount?: unknown; avgCheck?: unknown }[];
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Факт</h1>
        <p className="mt-1 text-muted-foreground">
          Профиль: {profile.name} • Ввод фактических значений для регулярных статей
        </p>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-medium text-foreground">
          Чем больше фактических данных вы введёте, тем точнее будет прогноз.
        </p>
      </div>
      <FactPage
        profile={serializedProfile}
        currency={profile.currency}
        profileId={profile.id}
      />
    </div>
  );
}
