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
    <section id="features" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Все инструменты для финансового планирования
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Полный набор функций для эффективного управления денежными потоками
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 rounded-lg hover:bg-surface transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="text-primary" size={20} />
                    </div>
                    <span className="text-foreground mt-2">
                      {feature.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 sm:p-6 lg:p-8 border border-primary/20">
            <div className="bg-surface rounded-lg shadow-xl p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-danger"></div>
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-primary" size={20} />
                    <span className="text-sm text-foreground">Аренда офиса</span>
                  </div>
                  <span className="font-semibold text-danger">-75,000 ₽</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-primary" size={20} />
                    <span className="text-sm text-foreground">Зарплата сотрудников</span>
                  </div>
                  <span className="font-semibold text-danger">-320,000 ₽</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/30">
                  <div className="flex items-center gap-3">
                    <Check className="text-primary" size={20} />
                    <span className="text-sm text-foreground">Оплата от клиентов</span>
                  </div>
                  <span className="font-semibold text-success">+850,000 ₽</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="text-primary" size={20} />
                    <span className="text-sm text-foreground">Налоги и взносы</span>
                  </div>
                  <span className="font-semibold text-danger">-120,000 ₽</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Итого за месяц:</span>
                  <span className="text-xl font-bold text-primary">+335,000 ₽</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
