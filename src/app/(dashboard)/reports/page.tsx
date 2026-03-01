import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportGenerator } from "@/components/reports/report-generator";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });

  if (!user) redirect("/login");
  const profile = user.profiles[0];
  if (!profile) redirect("/onboarding");

  const canExportPDF = user.subscription?.plan !== "FREE";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Отчёты</h1>
        <p className="mt-1 text-muted-foreground">
          Скачайте прогноз в PDF или Excel
        </p>
      </div>
      <ReportGenerator
        profileId={profile.id}
        profileName={profile.name}
        canExportPDF={canExportPDF}
      />
    </div>
  );
}
