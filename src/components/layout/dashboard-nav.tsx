"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { User } from "next-auth";

const navItems = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/cashflow", label: "Планировщик" },
  { href: "/what-if", label: "Что если" },
  { href: "/insights", label: "ИИ-ассистент" },
  { href: "/reports", label: "Отчёты" },
  { href: "/billing", label: "Тарифы" },
  { href: "/settings", label: "Настройки" },
];

export function DashboardNav({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface">
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
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
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
