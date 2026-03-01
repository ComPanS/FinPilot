import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InsightsChat } from "@/components/insights/insights-chat";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });

  if (!user) redirect("/login");
  const profile = user.profiles[0];
  if (!profile) redirect("/onboarding");

  const recentRequests = await prisma.aIRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ИИ-ассистент</h1>
        <p className="mt-1 text-muted-foreground">
          Задайте вопрос о вашем прогнозе и получите рекомендации
        </p>
      </div>
      <InsightsChat
        profileId={profile.id}
        recentRequests={recentRequests}
      />
    </div>
  );
}
