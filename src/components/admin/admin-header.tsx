"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";

export function AdminHeader({ user }: { user: User }) {
  const adminPath = process.env.NEXT_PUBLIC_ADMIN_PATH || "admin";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-primary shrink-0 hover:opacity-90"
          >
            ФинПланер
          </Link>
          <Link
            href={`/${adminPath}`}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Админ-панель
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
