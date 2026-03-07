import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-primary to-primary-dark">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
          Начните управлять финансами бизнеса за 5 минут
        </h2>
        <p className="text-lg text-white/90 mb-10 max-w-2xl mx-auto">
          Присоединяйтесь к сотням предпринимателей, которые уже контролируют свои денежные потоки с помощью ФинПилот
        </p>

        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-primary px-10 py-4 rounded-lg transition-all font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 cursor-pointer"
        >
          Создать первый прогноз
          <ArrowRight size={20} />
        </Link>

        <p className="text-white/80 mt-6 text-sm">
          Бесплатно • Без кредитной карты • Настройка за 2 минуты
        </p>
      </div>
    </section>
  );
}
