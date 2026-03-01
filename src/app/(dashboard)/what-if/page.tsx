import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WhatIfSimulator } from "@/components/what-if/what-if-simulator";

export default async function WhatIfPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profiles: true,
      subscription: true,
    },
  });

  if (!user) redirect("/login");
  const profile = user.profiles[0];
  if (!profile) redirect("/onboarding");

  const scenarios = await prisma.whatIfScenario.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Режим «Что если»</h1>
        <p className="mt-1 text-muted-foreground">
          Симулируйте изменения и смотрите, как изменится прогноз
        </p>
      </div>
      <WhatIfSimulator
        profileId={profile.id}
        scenarios={scenarios}
        forecastDays={user.subscription?.plan === "FREE" ? 30 : 90}
      />
    </div>
  );
}
