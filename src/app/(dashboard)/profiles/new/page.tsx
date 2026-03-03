import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function NewProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user?.profiles?.length) redirect("/onboarding");

  const [expenseCategories, incomeCategories] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
      orderBy: { name: "asc" },
    }),
    prisma.incomeCategory.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">Новый профиль</h1>
      <p className="mt-2 text-muted-foreground">
        Заполните данные о новом бизнесе — это займёт 2 минуты
      </p>
      <OnboardingWizard
        mode="addProfile"
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </div>
  );
}
