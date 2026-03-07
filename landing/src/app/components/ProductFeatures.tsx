import { Calendar, Repeat, FileSpreadsheet, TrendingUp, GitBranch, Sparkles, FileDown, Building2, Check } from "lucide-react";

export function ProductFeatures() {
  const features = [
    { icon: Calendar, text: "Планировщик расходов и доходов" },
    { icon: Repeat, text: "Разовые и повторяющиеся операции" },
    { icon: FileSpreadsheet, text: "Импорт данных из Excel" },
    { icon: TrendingUp, text: "Прогноз на 90 дней" },
    { icon: GitBranch, text: "Сценарии 'Что если'" },
    { icon: Sparkles, text: "ИИ-ассистент" },
    { icon: FileDown, text: "Экспорт в PDF и Excel" },
    { icon: Building2, text: "Несколько профилей бизнеса" },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-4">
            Все инструменты для финансового планирования
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            Полный набор функций для эффективного управления денежными потоками
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Features List */}
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                      <Icon className="text-[#10B981]" size={20} />
                    </div>
                    <span className="text-[#0F172A] mt-2">
                      {feature.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Screenshot Placeholder */}
          <div className="bg-gradient-to-br from-[#10B981]/5 to-[#10B981]/10 rounded-xl p-8 border border-[#10B981]/20">
            <div className="bg-white rounded-lg shadow-xl p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#E2E8F0]">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div>
                <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-[#10B981]" size={20} />
                    <span className="text-sm text-[#0F172A]">Аренда офиса</span>
                  </div>
                  <span className="font-semibold text-[#EF4444]">-75,000 ₽</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-[#10B981]" size={20} />
                    <span className="text-sm text-[#0F172A]">Зарплата сотрудников</span>
                  </div>
                  <span className="font-semibold text-[#EF4444]">-320,000 ₽</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#DCFCE7] rounded-lg border border-[#BBF7D0]">
                  <div className="flex items-center gap-3">
                    <Check className="text-[#10B981]" size={20} />
                    <span className="text-sm text-[#0F172A]">Оплата от клиентов</span>
                  </div>
                  <span className="font-semibold text-[#22C55E]">+850,000 ₽</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-[#10B981]" size={20} />
                    <span className="text-sm text-[#0F172A]">Налоги и взносы</span>
                  </div>
                  <span className="font-semibold text-[#EF4444]">-120,000 ₽</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F172A]">Итого за месяц:</span>
                  <span className="text-xl font-bold text-[#10B981]">+335,000 ₽</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
