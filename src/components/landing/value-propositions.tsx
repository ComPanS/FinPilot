import { TrendingUp, GitBranch, Sparkles } from "lucide-react";

export function ValuePropositions() {
  const features = [
    {
      icon: TrendingUp,
      title: "Прогноз на 90 дней",
      description: "Автоматический расчет доходов и расходов вперед.",
    },
    {
      icon: GitBranch,
      title: "Режим 'Что если'",
      description: "Симулируйте задержки оплат или новые расходы.",
    },
    {
      icon: Sparkles,
      title: "ИИ-ассистент",
      description: "Получайте конкретные рекомендации для бизнеса.",
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-surface rounded-xl p-8 border border-border hover:border-primary hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Icon className="text-primary" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
