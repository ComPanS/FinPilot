import { Check } from "lucide-react";
import Link from "next/link";
import type { PlanConfig } from "@/config/plans";

type PricingSectionProps = {
  plans: PlanConfig[];
};

export function PricingSection({ plans }: PricingSectionProps) {
  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Прозрачные тарифы
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Выберите план, который подходит вашему бизнесу. Первые 14 дней Pro — бесплатно.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const highlighted = plan.id === "PRO";
            const period = plan.id === "FREE" ? "навсегда" : "месяц";
            const cta = plan.id === "FREE" ? "Начать бесплатно" : "Попробовать 14 дней";
            const priceDisplay = plan.id === "FREE" ? "0" : String(plan.price);

            return (
              <div
                key={plan.id}
                className={`bg-surface rounded-xl p-4 sm:p-6 lg:p-8 border-2 transition-all duration-300 hover:shadow-xl ${
                  highlighted
                    ? "border-primary shadow-lg scale-105"
                    : "border-border hover:border-primary"
                }`}
              >
                {highlighted && (
                  <div className="inline-block bg-primary text-white text-sm font-semibold px-4 py-1 rounded-full mb-4">
                    Популярный
                  </div>
                )}

                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-4xl font-bold text-foreground">
                      {priceDisplay}
                    </span>
                    <span className="text-2xl font-bold text-foreground">₽</span>
                    <span className="text-muted-foreground">/ {period}</span>
                  </div>
                  {plan.priceYear > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.priceYearLabel}
                      {plan.yearlySavingsPercent > 0 && ` (экономия ${plan.yearlySavingsPercent}%)`}
                    </p>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.featuresList.slice(0, 6).map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check
                        className="text-primary flex-shrink-0 mt-0.5"
                        size={20}
                      />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block w-full py-3 px-6 rounded-lg font-semibold transition-colors text-center cursor-pointer ${
                    highlighted
                      ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                      : "bg-background hover:bg-primary hover:text-white text-foreground border-2 border-border"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Все платные планы включают 14-дневный бесплатный пробный период. Кредитная карта не требуется.
          </p>
        </div>
      </div>
    </section>
  );
}
