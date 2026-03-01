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
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Настройка профиля</h1>
      <p className="mt-2 text-muted-foreground">
        Заполните данные о вашем бизнесе — это займёт 2 минуты
      </p>
      <OnboardingWizard />
    </div>
  );
}
