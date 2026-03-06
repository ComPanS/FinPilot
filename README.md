# FinPilot
**Полное техническое задание (ТЗ) на разработку продукта «Управленка за 5 минут» — Кассовый планировщик для ИП и микробизнеса**

**Версия документа:** 1.0  
**Дата:** 1 марта 2026 г.  
**Стек:** строго **Node.js + Next.js 15** (полноценный full-stack).  
**ИИ-интеграция:** через NEUROAPI (модель `grok-4-fast-non-reasoning`).
**Название:** ФинПилот
**Язык:** русский

### 1. Общее описание проекта
«Управленка за 5 минут» — SaaS-приложение, позволяющее индивидуальным предпринимателям и владельцам микробизнеса (до 10 сотрудников, оборот до 10 млн руб./мес.) за 5 минут построить точный прогноз денежных потоков на 3 месяца вперёд, выявить кассовые разрывы и получить персональные рекомендации.

**MVP-цель:** запуск через 8–10 недель с полным циклом от регистрации до первого прогноза.  
**Полная версия (v1.0):** + ИИ-ассистент, экспорт, несколько профилей бизнеса, история сценариев.

**Ключевые метрики успеха:**
- Время создания первого прогноза ≤ 5 минут.
- Удержание пользователей на 30-й день ≥ 45 %.
- Конверсия в платную подписку ≥ 12 %.

### 2. Целевая аудитория и User Personas
- ИП на УСН/Патенте (торговля, услуги, производство).
- Микробизнес (ИП + до 5 сотрудников).
- Возраст 28–55 лет, средний чек 500–1500 руб./мес.

**Persona 1:** Анна, 34 года, ИП «Кофе с собой», 3 точки, Excel каждый месяц.
**Persona 2:** Дмитрий, 41 год, автосервис, 4 сотрудника, боится «красных зон» перед налогами.

### 3. Полный функционал (разбит по модулям)

#### 3.1. Аутентификация и онбординг
- Email + пароль / Google / VK.
- 3-шаговый онбординг: название бизнеса → валюта (RUB) → первые 5 регулярных расходов/доходов.

#### 3.2. Основной планировщик (Cash Flow Engine)
- **Регулярные расходы** (аренда, зарплата, налоги, закупки, подписки и т.д.).
  - Поля: название, сумма, частота (ежемесячно / ежеквартально / раз в год), дата начала, категория (12 предустановленных + custom).
- **Регулярные поступления**.
  - Средний чек × план продаж по месяцам.
- **Разовые операции** (ввод вручную с датой).
- Автоматический расчёт ежедневного/ежемесячного баланса на 90 дней вперёд.
- Формула:  
  `Balance[t] = Balance[t-1] + Inflows[t] – Outflows[t]`

#### 3.3. Визуализация
- Интерактивный график (линейный + столбчатый) на 90 дней.
- Цветовая индикация:
  - Зелёный ≥ +50 000 руб.
  - Жёлтый –50 000 … +50 000 руб.
  - Красный < –50 000 руб. («красная зона»).
- Таблица «Дни до разрыва» + список ближайших красных зон.

#### 3.4. Режим «Что если»
- Слайдеры и поля: «Задержка оплаты клиентов на N дней», «+20 % закупки», «Новый сотрудник с 15 марта».
- Мгновенный пересчёт графика.
- Сохранение до 10 сценариев на пользователя.

#### 3.5. ИИ-ассистент (на базе NEUROAPI)
- Кнопка «Спросить ИИ» на всех ключевых экранах.
- Примеры запросов (автогенерация промпта):
  1. «Проанализируй мой прогноз и дай 3 конкретные рекомендации по устранению кассовых разрывов».
  2. «Что будет, если я получу оплату от клиента Иванов на 10 дней позже?».
  3. «Сравни мой план продаж с реальностью за последние 3 месяца и предложи корректировку».
- Ответы в формате Markdown + кнопка «Применить рекомендацию к прогнозу».
- Лимиты: бесплатный тариф — 5 запросов/день, Pro — безлимит.

**Переменные окружения для ИИ:**
```properties
NEUROAPI_API_KEY=sk-...
NEUROAPI_BASE_URL=https://neuroapi.host/v1
NEUROAPI_MODEL=grok-4-fast-non-reasoning
```

#### 3.6. Отчёты и экспорт
- PDF/Excel отчёт за любой период.
- Еженедельная email-рассылка «Ваш прогноз на следующую неделю».

#### 3.7. Биллинг и настройки
- Планы: Free (1 профиль, 5 запросов ИИ), Pro (499 руб./мес.), Business (999 руб./мес. — до 5 профилей).
- Stripe (Subscription + Payment Links).
- Профиль, смена пароля, удаление данных.

### 4. Дизайн-система

**Цветовая палитра (Tailwind + CSS variables):**
- Primary: `#10B981` (emerald-500) — кнопки, акценты роста.
- Primary-dark: `#059669`.
- Success: `#22C55E`.
- Danger: `#EF4444` (красные зоны).
- Warning: `#F59E0B`.
- Neutral:
  - Background: `#F8FAFC` (light) / `#0F172A` (dark).
  - Surface: `#FFFFFF` / `#1E2937`.
  - Text-primary: `#0F172A` / `#F1F5F9`.
  - Border: `#E2E8F0` / `#334155`.

**Типографика:** Inter (400, 500, 600, 700).  
**Border-radius:** 12 px (cards), 8 px (buttons).  
**Shadow:** sm (0 1px 3px rgba(0,0,0,0.1)), md (0 4px 6px -1px rgba(0,0,0,0.1)).  
**Dark mode:** обязателен (next-themes).

**UI-библиотека:** shadcn/ui + Radix UI + Tailwind CSS.  
**Графики:** Recharts (Server Components compatible).  
**Иконки:** Lucide React.

### 5. Полное описание всех страниц (Next.js App Router)

1. `/` — Лендинг (marketing site, SSG).
2. `/login`, `/register`, `/forgot-password`.
3. `/onboarding` — 3 шага (Server Actions).
4. `/dashboard` — Главный дашборд (Server Component + TanStack Query для обновлений).
5. `/cashflow` — Полный планировщик (табы: Регулярные расходы / Доходы / Разовые / График).
6. `/what-if` — Симулятор сценариев.
7. `/insights` — ИИ-чат + история запросов.
8. `/reports` — Генерация и скачивание отчётов.
9. `/billing` — Тарифы и управление подпиской.
10. `/settings` — Профиль, уведомления, экспорт данных.
11. `/api/...` — Route Handlers (protected).

Все защищённые страницы — в группе `(app)` с middleware.

### 6. Техническая архитектура

**Монолит на Next.js 15 (App Router)**
- **Rendering:** 90 % Server Components + Server Actions.
- **Data Fetching:** React Cache + TanStack Query (только клиентские части).
- **Backend:** Route Handlers (`app/api/`) + Server Actions (мутации).
- **База данных:** PostgreSQL (Neon или Supabase).
- **ORM:** Prisma (с Prisma Accelerate для edge).
- **Аутентификация:** Auth.js (NextAuth) v5 + Credentials + OAuth.
- **Валидация:** Zod + React Hook Form.
- **State:** Zustand (только глобальные UI-состояния).
- **Кэширование:** Next.js Cache + Redis (Upstash) для прогнозов.

**Структура папок (рекомендуемая):**
```
/app
  /(auth)/
  /(dashboard)/
    layout.tsx
    dashboard/page.tsx
  api/
  /lib
    prisma.ts
    neuroapi.ts
  /components
    ui/ (shadcn)
    dashboard/
    cashflow/
  /hooks
  /types
/prisma
```

### 7. Модель данных (основные таблицы Prisma)

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String?
  subscription   Subscription?
  profiles       CashFlowProfile[]
  createdAt      DateTime @default(now())
}

model CashFlowProfile {
  id                String   @id @default(cuid())
  userId            String
  name              String   // "Кофе с собой — точка 1"
  currency          String   @default("RUB")
  regularExpenses   RegularExpense[]
  regularIncomes    RegularIncome[]
  manualTransactions ManualTransaction[]
  scenarios         WhatIfScenario[]
  forecasts         Forecast[]
}

model RegularExpense { ... } // name, amount, frequency, category, startDate
model RegularIncome  { ... }
model ManualTransaction { date, type, amount, description, category }
model WhatIfScenario { name, changesJson, createdAt }
model Forecast { profileId, date, projectedBalance, actualBalance? }
model Subscription { userId, stripeId, plan, status, currentPeriodEnd }
```

### 8. Интеграция ИИ (NEUROAPI)

```ts
// lib/neuroapi.ts
export async function askNeuro(prompt: string, context: any) {
  const fullPrompt = `Ты — финансовый директор ИП. Данные пользователя: ${JSON.stringify(context)}. Ответь кратко, по делу, на русском. Вопрос: ${prompt}`;
  
  const res = await fetch(`${process.env.NEUROAPI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEUROAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.NEUROAPI_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });
  // парсинг + сохранение в БД
}
```

Вызов из Server Action или Client Component (с loading state).

### 9. Безопасность и compliance
- Все финансовые данные шифруются на уровне приложения (AES-256 для чувствительных полей).
- Row Level Security в PostgreSQL.
- Rate limiting (Upstash).
- Соответствие 152-ФЗ и GDPR (согласие на обработку).

### 10. Монетизация
Юкасса
- Freemium: 1 профиль, 5 ИИ-запросов/день, 30-дневный прогноз.
- Pro: 499 руб./мес. — безлимит, 3 профиля, экспорт PDF.
- Business: 999 руб./мес. — 5 профилей, приоритетная поддержка.
- Stripe Checkout + Webhooks (Next.js Route Handler).

