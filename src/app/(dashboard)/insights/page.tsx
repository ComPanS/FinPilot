import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { canUserUseAIChat } from "@/lib/plan-utils";
import { InsightsChat } from "@/components/insights/insights-chat";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const profile = getActiveProfile(user, cookieStore);
  if (!profile) redirect("/onboarding");

  const canUseAI = canUserUseAIChat(user.subscription);

  if (!canUseAI) {
    return (
      <div className="space-y-8" data-tour-id="insights-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ИИ-ассистент</h1>
          <p className="mt-1 text-muted-foreground">
            ИИ-ассистент доступен в тарифе Pro
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-muted-foreground">
            Задавайте вопросы о прогнозе и получайте персональные рекомендации по устранению кассовых разрывов.
          </p>
          <Link
            href="/billing"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
          >
            Перейти на Pro
          </Link>
        </div>
      </div>
    );
  }

  const recentRequests = await prisma.aIRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8" data-tour-id="insights-page">
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
