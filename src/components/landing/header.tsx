"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border backdrop-blur-sm bg-surface/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-foreground cursor-pointer">
              ФинПилот
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-foreground hover:text-primary transition-colors cursor-pointer">
              Функции
            </Link>
            <Link href="#how-it-works" className="text-foreground hover:text-primary transition-colors cursor-pointer">
              Как это работает
            </Link>
            <Link href="#pricing" className="text-foreground hover:text-primary transition-colors cursor-pointer">
              Тарифы
            </Link>
            <Link href="#faq" className="text-foreground hover:text-primary transition-colors cursor-pointer">
              FAQ
            </Link>
            <Link href="/login" className="text-foreground hover:text-primary transition-colors cursor-pointer">
              Войти
            </Link>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Link
              href="/register"
              className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              Создать прогноз
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col space-y-4">
              <Link href="#features" className="text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                Функции
              </Link>
              <Link href="#how-it-works" className="text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                Как это работает
              </Link>
              <Link href="#pricing" className="text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                Тарифы
              </Link>
              <Link href="#faq" className="text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                FAQ
              </Link>
              <Link href="/login" className="text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                Войти
              </Link>
              <Link
                href="/register"
                className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-lg transition-colors font-medium cursor-pointer inline-block text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Создать прогноз
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
