import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getActiveProfile, getActiveProfileId } from "@/lib/active-profile";
import { expireTrialIfNeeded, startTrialIfEligible } from "@/app/actions/trial";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
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
      <DashboardLayoutClient
        user={session.user}
        profiles={user.profiles}
        activeProfileId={activeProfileId}
      >
        {children}
      </DashboardLayoutClient>
    </TourWrapper>
  );
}
