import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BillingPlans } from "@/components/billing/billing-plans";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subscription: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Тарифы</h1>
        <p className="mt-1 text-muted-foreground">
          Текущий план: {user.subscription?.plan ?? "FREE"}
        </p>
      </div>
      <BillingPlans
        currentPlan={user.subscription?.plan ?? "FREE"}
        userId={user.id}
      />
    </div>
  );
}
