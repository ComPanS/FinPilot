import { FileText, Cog, CheckCircle } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: FileText,
      number: "1",
      title: "Добавьте расходы и доходы",
      description: "(можно текстом или импорт Excel)",
    },
    {
      icon: Cog,
      number: "2",
      title: "Сервис автоматически строит прогноз",
      description: "Алгоритмы рассчитывают ваши денежные потоки",
    },
    {
      icon: CheckCircle,
      number: "3",
      title: "Получите рекомендации ИИ и отчёт",
      description: "Готовый прогноз с советами для вашего бизнеса",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Как это работает
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Всего три простых шага до вашего первого прогноза
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-20 left-0 right-0 h-0.5 bg-border -z-10" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <div className="bg-surface rounded-xl p-4 sm:p-6 lg:p-8 shadow-lg border border-border text-center">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    {step.number}
                  </div>

                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 mt-4">
                    <Icon className="text-primary" size={32} />
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
