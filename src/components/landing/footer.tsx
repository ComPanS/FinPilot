import { Mail } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="text-2xl font-bold mb-4">ФинПилот</div>
            <p className="text-gray-400 mb-4">
              Управление денежными потоками для малого бизнеса и индивидуальных предпринимателей.
            </p>
            <div className="flex items-center gap-2 text-gray-400">
              <Mail size={18} />
              <a
                href="mailto:support@finpilot.ru"
                className="hover:text-primary transition-colors cursor-pointer"
              >
                support@finpilot.ru
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Продукт</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link href="#features" className="hover:text-primary transition-colors cursor-pointer">
                  Функции
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-primary transition-colors cursor-pointer">
                  Тарифы
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-primary transition-colors cursor-pointer">
                  Как это работает
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-primary transition-colors cursor-pointer">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Документы</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link href="/privacy" className="hover:text-primary transition-colors cursor-pointer">
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors cursor-pointer">
                  Правила использования
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors cursor-pointer">
                  Договор оферты
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          <p>© 2026 ФинПилот. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
