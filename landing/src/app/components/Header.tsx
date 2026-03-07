import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0] backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-xl font-bold text-[#0F172A]">
              ФинПланер
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
              Функции
            </a>
            <a href="#how-it-works" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
              Как это работает
            </a>
            <a href="#pricing" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
              Тарифы
            </a>
            <a href="#faq" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
              FAQ
            </a>
            <a href="#" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
              Войти
            </a>
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <button className="bg-[#10B981] hover:bg-[#059669] text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
              Создать прогноз
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#E2E8F0]">
            <nav className="flex flex-col space-y-4">
              <a href="#features" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
                Функции
              </a>
              <a href="#how-it-works" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
                Как это работает
              </a>
              <a href="#pricing" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
                Тарифы
              </a>
              <a href="#faq" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
                FAQ
              </a>
              <a href="#" className="text-[#0F172A] hover:text-[#10B981] transition-colors">
                Войти
              </a>
              <button className="bg-[#10B981] hover:bg-[#059669] text-white px-6 py-2.5 rounded-lg transition-colors font-medium">
                Создать прогноз
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
