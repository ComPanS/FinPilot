"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import type { Session } from "next-auth";

export function LegalHeaderClient({ session }: { session: Session | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-primary shrink-0">
          ФинПланер
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Политика конфиденциальности
          </Link>
          <Link
            href="/terms"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Правила использования
          </Link>
          {session?.user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              В кабинет
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                Начать бесплатно
              </Link>
            </>
          )}
        </nav>

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
          <nav className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Правила использования
            </Link>
            {session?.user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark inline-block text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                В кабинет
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark inline-block text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Начать бесплатно
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
