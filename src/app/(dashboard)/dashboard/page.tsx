import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

  return (
    <div className="space-y-8">
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
