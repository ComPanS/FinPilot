import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (user?.profiles?.length) redirect("/dashboard");

  const [expenseCategories, incomeCategories] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: user ? { OR: [{ isSystem: true }, { userId: user.id }] } : { isSystem: true },
      orderBy: { name: "asc" },
    }),
    prisma.incomeCategory.findMany({
      where: user ? { OR: [{ isSystem: true }, { userId: user.id }] } : { isSystem: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[min(100%,28rem)] sm:max-w-[32rem] md:max-w-[36rem] lg:max-w-[42rem] xl:max-w-[48rem]">
      <h1 className="text-2xl font-bold text-foreground">Настройка профиля</h1>
      <p className="mt-2 text-muted-foreground">
        Заполните данные о вашем бизнесе — это займёт 2 минуты
      </p>
      <OnboardingWizard
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </div>
  );
}
