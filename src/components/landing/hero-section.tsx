import { CheckCircle2, Play, Shield, FileCheck, Lock } from "lucide-react";
import Link from "next/link";
import { DashboardMockup } from "./dashboard-mockup-dynamic";

export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-background to-surface py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-6 leading-tight">
              Управленка за 5 минут
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 leading-relaxed">
              Постройте прогноз денежных потоков на 90 дней, выявите кассовые разрывы и получите рекомендации ИИ — без сложных таблиц.
            </p>

            {/* Benefits */}
            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-primary flex-shrink-0 mt-1" size={24} />
                <span className="text-foreground">Прогноз кассовых потоков на 90 дней</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-primary flex-shrink-0 mt-1" size={24} />
                <span className="text-foreground">Выявление кассовых разрывов</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-primary flex-shrink-0 mt-1" size={24} />
                <span className="text-foreground">Рекомендации ИИ для бизнеса</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link
                href="/register"
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg transition-colors font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 cursor-pointer inline-flex justify-center items-center"
              >
                Создать первый прогноз — бесплатно
              </Link>
              <Link
                href="#features"
                className="border-2 border-border hover:border-primary text-foreground px-6 py-3 sm:px-8 sm:py-4 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 bg-surface cursor-pointer"
              >
                <Play size={20} />
                Смотреть демо
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                <span>AES-256 encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                <span>152-ФЗ / GDPR</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-primary" />
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
