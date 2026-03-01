import Link from "next/link";

export default function LandingPage() {
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
            <h3 className="font-semibold text-foreground">Прогноз на 90 дней</h3>
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
      </main>
    </div>
  );
}
