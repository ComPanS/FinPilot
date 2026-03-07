import { CheckCircle2, Play, Shield, FileCheck, Lock } from "lucide-react";
import { DashboardMockup } from "./DashboardMockup";

export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-[#F8FAFC] to-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-[#0F172A] mb-6 leading-tight">
              Управленка за 5 минут
            </h1>
            <p className="text-lg lg:text-xl text-[#475569] mb-8 leading-relaxed">
              Постройте прогноз денежных потоков на 90 дней, выявите кассовые разрывы и получите рекомендации ИИ — без сложных таблиц.
            </p>

            {/* Benefits */}
            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] flex-shrink-0 mt-1" size={24} />
                <span className="text-[#0F172A]">Прогноз кассовых потоков на 90 дней</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] flex-shrink-0 mt-1" size={24} />
                <span className="text-[#0F172A]">Выявление кассовых разрывов</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] flex-shrink-0 mt-1" size={24} />
                <span className="text-[#0F172A]">Рекомендации ИИ для бизнеса</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button className="bg-[#10B981] hover:bg-[#059669] text-white px-8 py-4 rounded-lg transition-colors font-semibold shadow-lg shadow-[#10B981]/20 hover:shadow-xl hover:shadow-[#10B981]/30">
                Создать первый прогноз — бесплатно
              </button>
              <button className="border-2 border-[#E2E8F0] hover:border-[#10B981] text-[#0F172A] px-8 py-4 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 bg-white">
                <Play size={20} />
                Смотреть демо
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-[#475569]">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-[#10B981]" />
                <span>AES-256 encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-[#10B981]" />
                <span>152-ФЗ / GDPR</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-[#10B981]" />
                <span>14-дневный Pro trial</span>
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard Mockup */}
          <div className="lg:pl-8">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
