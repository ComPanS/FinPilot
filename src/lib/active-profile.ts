import type { CashFlowProfile, User } from "@prisma/client";

export const ACTIVE_PROFILE_COOKIE = "finpilot_active_profile";

export type UserWithProfiles = User & { profiles: CashFlowProfile[] };

export function getActiveProfileId(cookieStore: { get: (name: string) => { value: string } | undefined }): string | undefined {
  const cookie = cookieStore.get(ACTIVE_PROFILE_COOKIE);
  return cookie?.value || undefined;
}

export function getActiveProfile<T extends CashFlowProfile>(
  user: User & { profiles: T[] },
  cookieStore: { get: (name: string) => { value: string } | undefined }
): T | null {
  if (!user.profiles?.length) return null;
  const activeId = getActiveProfileId(cookieStore);
  if (activeId) {
    const found = user.profiles.find((p) => p.id === activeId);
    if (found) return found;
  }
  return user.profiles[0] ?? null;
}
