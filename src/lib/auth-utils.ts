import type { Session } from "next-auth";

export function getSessionUserId(session: Session | null): string | null {
  if (!session?.user) return null;
  const id = (session.user as { id?: string }).id;
  if (id) return id;
  return session.user.email ?? null;
}
