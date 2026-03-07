import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile, getActiveProfileId } from "@/lib/active-profile";
import { expireTrialIfNeeded, startTrialIfEligible } from "@/app/actions/trial";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { TourWrapper } from "@/components/tour/TourWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    include: { profiles: true, subscription: true },
  });
  if (!user) redirect("/login");

  await expireTrialIfNeeded(user.id);
  await startTrialIfEligible(user.id);

  const cookieStore = await cookies();
  const activeProfile = getActiveProfile(user, cookieStore);
  const activeProfileId = getActiveProfileId(cookieStore) ?? activeProfile?.id ?? null;

  return (
    <TourWrapper tourCompleted={user.tourCompleted}>
      <div className="min-h-screen bg-background">
        <DashboardNav
          user={session.user}
          profiles={user.profiles}
          activeProfileId={activeProfileId}
        />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </TourWrapper>
  );
}
