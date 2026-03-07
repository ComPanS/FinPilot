import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PLANS } from "@/config/plans";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const displayPlans = [PLANS.FREE, PLANS.STANDARD, PLANS.PRO];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-xl font-bold text-primary">ФинПилот</span>
          <nav className="flex gap-4">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark transition-colors"
            >
              Начать бесплатно
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Управленка за 5 минут
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Кассовый планировщик для ИП и микробизнеса. Постройте точный прогноз
            денежных потоков на 3 месяца, выявите кассовые разрывы и получите
            персональные рекомендации от ИИ.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark transition-colors"
            >
              Создать первый прогноз
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-surface transition-colors"
            >
              Уже есть аккаунт
            </Link>
          </div>
        </div>
        <div className="mt-24 grid gap-8 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-semibold text-foreground">
              Прогноз до 90 дней
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Автоматический расчёт ежедневного баланса. Видите красные зоны
              заранее.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-semibold text-foreground">Режим «Что если»</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Слайдеры для симуляции: задержка оплаты, рост закупок, новый
              сотрудник.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="font-semibold text-foreground">ИИ-ассистент</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Персональные рекомендации по устранению кассовых разрывов.
            </p>
          </div>
        </div>

        <section className="mt-24">
          <h2 className="text-center text-2xl font-bold text-foreground">Тарифы</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Начните бесплатно. Годовая подписка — 2 месяца в подарок.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {displayPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 ${
                  plan.id === "PRO" ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-2 text-2xl font-bold">{plan.priceLabel}</p>
                {plan.priceYear > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.priceYearLabel} {plan.yearlySavingsPercent > 0 && `(экономия ${plan.yearlySavingsPercent}%)`}
                  </p>
                )}
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {plan.featuresList.slice(0, 5).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-6 block w-full rounded-lg px-4 py-2 text-center font-medium transition-colors ${
                    plan.id === "PRO"
                      ? "bg-primary text-white hover:bg-primary-dark"
                      : "border border-border hover:bg-surface"
                  }`}
                >
                  {plan.id === "FREE" ? "Начать бесплатно" : "Выбрать"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
