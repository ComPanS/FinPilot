import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { ReportGenerator } from "@/components/reports/report-generator";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const profile = getActiveProfile(user, cookieStore);
  if (!profile) redirect("/onboarding");

  return (
    <div className="space-y-8" data-tour-id="reports-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Отчёты</h1>
        <p className="mt-1 text-muted-foreground">
          Скачайте прогноз в PDF или Excel
        </p>
      </div>
      <ReportGenerator
        profileId={profile.id}
        profileName={profile.name}
      />
    </div>
  );
}
