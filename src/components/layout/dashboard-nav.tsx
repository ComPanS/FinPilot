"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { User } from "next-auth";
import { ProfileSwitcher } from "./profile-switcher";

const navItems = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/cashflow", label: "Планировщик" },
  { href: "/fact", label: "Факт" },
  { href: "/what-if", label: "Что если" },
  { href: "/insights", label: "ИИ-ассистент" },
  { href: "/reports", label: "Отчёты" },
  { href: "/billing", label: "Тарифы" },
  { href: "/settings", label: "Настройки" },
];

const navTourIds: Record<string, string> = {
  "/dashboard": "nav-dashboard",
  "/cashflow": "nav-cashflow",
  "/fact": "nav-fact",
  "/what-if": "nav-what-if",
  "/insights": "nav-insights",
  "/reports": "nav-reports",
};

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative sticky top-0 z-50 border-b border-border bg-surface">
      {profiles.length > 0 && (
        <div className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 pl-4 md:block">
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
          />
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="text-xl font-bold text-primary shrink-0">
          ФинПланер
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 justify-center gap-1 min-w-0 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={navTourIds[item.href]}
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

        {/* Desktop: user + sign out */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <span className="text-sm text-muted-foreground truncate max-w-[180px]">
            {user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            Выйти
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4">
            {profiles.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <ProfileSwitcher
                  profiles={profiles}
                  activeProfileId={activeProfileId}
                />
              </div>
            )}
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour-id={navTourIds[item.href]}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground truncate px-3">
                {user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-left text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
