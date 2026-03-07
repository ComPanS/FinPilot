import { Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="text-2xl font-bold mb-4">ФинПланер</div>
            <p className="text-gray-400 mb-4">
              Управление денежными потоками для малого бизнеса и индивидуальных
              предпринимателей.
            </p>
            <div className="flex items-center gap-2 text-gray-400">
              <Mail size={18} />
              <a
                href="mailto:support@ffinplaner.ru"
                className="hover:text-[#10B981] transition-colors"
              >
                support@ffinplaner.ru
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Продукт</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a
                  href="#features"
                  className="hover:text-[#10B981] transition-colors"
                >
                  Функции
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-[#10B981] transition-colors"
                >
                  Тарифы
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="hover:text-[#10B981] transition-colors"
                >
                  Как это работает
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="hover:text-[#10B981] transition-colors"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Документы</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a href="#" className="hover:text-[#10B981] transition-colors">
                  Политика конфиденциальности
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#10B981] transition-colors">
                  Правила использования
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#10B981] transition-colors">
                  Договор оферты
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
          <p>© 2026 ФинПланер. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
