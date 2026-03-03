"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";
import { ProfileSwitcher } from "./profile-switcher";

const navItems = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/cashflow", label: "Планировщик" },
  { href: "/what-if", label: "Что если" },
  { href: "/insights", label: "ИИ-ассистент" },
  { href: "/reports", label: "Отчёты" },
  { href: "/billing", label: "Тарифы" },
  { href: "/settings", label: "Настройки" },
];

type Profile = { id: string; name: string; currency: string };

export function DashboardNav({
  user,
  profiles,
  activeProfileId,
}: {
  user: User;
  profiles: Profile[];
  activeProfileId: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="relative sticky top-0 z-50 border-b border-border bg-surface">
      {profiles.length > 0 && (
        <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2 pl-4">
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
          />
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          ФинПилот
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
