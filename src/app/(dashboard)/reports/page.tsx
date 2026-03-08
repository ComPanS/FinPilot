import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/active-profile";
import { canUserExportReports, getReportExportLimit } from "@/lib/plan-utils";
import { ReportGenerator } from "@/components/reports/report-generator";

export default async function ReportsPage() {
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

  const canExport = canUserExportReports(user.subscription);
  const limit = getReportExportLimit(user.subscription?.plan ?? "FREE", user.subscription?.trialEndsAt);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const used = user.subscription?.reportExportsMonth === monthKey ? (user.subscription?.reportExportsCount ?? 0) : 0;
  const remaining = limit >= 0 ? Math.max(0, limit - used) : -1;

  return (
    <div className="space-y-8" data-tour-id="reports-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Отчёты</h1>
        <p className="mt-1 text-muted-foreground">
          {canExport ? "Скачайте прогноз в PDF или Excel" : "Просмотр отчётов в интерфейсе. Экспорт доступен в тарифах Standard и Pro"}
        </p>
      </div>
      <ReportGenerator
        profileId={profile.id}
        profileName={profile.name}
        canExport={canExport}
        exportsRemaining={remaining}
        exportsLimit={limit}
      />
    </div>
  );
}
