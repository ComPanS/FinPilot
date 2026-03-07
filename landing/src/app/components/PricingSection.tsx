import { Check } from "lucide-react";

export function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "0",
      period: "навсегда",
      features: [
        "1 профиль бизнеса",
        "Прогноз на 30 дней",
        "Базовые функции",
        "Планирование доходов и расходов",
      ],
      cta: "Начать бесплатно",
      highlighted: false,
    },
    {
      name: "Standard",
      price: "490",
      period: "месяц",
      features: [
        "До 3 профилей бизнеса",
        "Прогноз на 60 дней",
        "Экспорт отчётов PDF/Excel",
        "Импорт из Excel",
        "Сценарии 'Что если'",
      ],
      cta: "Попробовать 14 дней",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "990",
      period: "месяц",
      badge: "Популярный",
      features: [
        "До 5 профилей бизнеса",
        "Прогноз на 90 дней",
        "ИИ-ассистент с рекомендациями",
        "Неограниченные отчёты",
        "Приоритетная поддержка",
        "Расширенная аналитика",
      ],
      cta: "Попробовать 14 дней",
      highlighted: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-4">
            Прозрачные тарифы
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            Выберите план, который подходит вашему бизнесу. Первые 14 дней Pro — бесплатно.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl p-8 border-2 transition-all duration-300 hover:shadow-xl ${
                plan.highlighted
                  ? "border-[#10B981] shadow-lg scale-105"
                  : "border-[#E2E8F0] hover:border-[#10B981]"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="inline-block bg-[#10B981] text-white text-sm font-semibold px-4 py-1 rounded-full mb-4">
                  {plan.badge}
                </div>
              )}

              {/* Plan Name */}
              <h3 className="text-2xl font-bold text-[#0F172A] mb-2">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#0F172A]">
                    {plan.price}
                  </span>
                  <span className="text-2xl font-bold text-[#0F172A]">₽</span>
                  <span className="text-[#475569]">/ {plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check
                      className="text-[#10B981] flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <span className="text-[#0F172A]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-[#10B981]/20"
                    : "bg-[#F8FAFC] hover:bg-[#10B981] hover:text-white text-[#0F172A] border-2 border-[#E2E8F0]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Trial Notice */}
        <div className="text-center mt-12">
          <p className="text-[#475569]">
            Все платные планы включают 14-дневный бесплатный пробный период. Кредитная карта не требуется.
          </p>
        </div>
      </div>
    </section>
  );
}
