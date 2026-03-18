"use client";

import { usePathname } from "next/navigation";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import type { User } from "next-auth";

type Profile = { id: string; name: string; currency: string };

export function DashboardLayoutClient({
  user,
  profiles,
  activeProfileId,
  children,
}: {
  user: User;
  profiles: Profile[];
  activeProfileId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  return (
    <div className="min-h-screen bg-background">
      {!isOnboarding && (
        <DashboardNav
          user={user}
          profiles={profiles}
          activeProfileId={activeProfileId}
        />
      )}
      <main
        className={`mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 ${
          isOnboarding ? "min-h-screen flex flex-col justify-center" : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
