# Прогноз доходов и прибыли в FinPilot

Подробное описание того, как реализован прогноз доходов и прибыли: от источников данных до отображения на фронтенде.

---

## Содержание

1. [Общая архитектура](#1-общая-архитектура)
2. [Типы данных](#2-типы-данных)
3. [Источники данных для прогноза](#3-источники-данных-для-прогноза)
4. [Бэкенд: сервис прогноза](#4-бэкенд-сервис-прогноза)
5. [Бэкенд: серверные экшены](#5-бэкенд-серверные-экшены)
6. [Фронтенд: где и как отображается прогноз](#6-фронтенд-где-и-как-отображается-прогноз)
7. [Формулы и расчёты](#7-формулы-и-расчёты)

---

## 1. Общая архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Dashboard (page.tsx)          CashFlowPlanner              WhatIfSimulator   │
│       │                              │                            │         │
│       │ getForecastAction()           │ getForecastAction()        │         │
│       ▼                              ▼                            ▼         │
│  DashboardCharts              ForecastChart              Scenario comparison │
│  (прибыль, доход, расход,     (баланс по дням)           (baseline vs scenario)│
│   ожидаемый vs факт)                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER ACTIONS (forecast.ts)                          │
│  getForecastAction(profileId, { days, startDate, changes, useExpectedData })  │
│  getForecastDebugAction(profileId)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORECAST SERVICE (lib/services/forecast.ts)               │
│  computeForecast()         — полный прогноз (ожидаемый + факт)                │
│  computeForecastActualOnly() — только дни с фактическими данными             │
│  computeHistoricalBalance()  — баланс на дату из истории                     │
│  getRedZones()            — дни с балансом < zoneRedMax                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ expected-data.ts     │  │ actual-data.ts        │  │ expected-from-actual  │
│ Ожидаемые суммы      │  │ Фактические записи    │  │ Паттерны из истории   │
│ (ExpectedEntry,      │  │ (ActualEntry)         │  │ (день недели,         │
│  ProfileMonthlyData) │  │                       │  │  день месяца)         │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## 2. Типы данных

### 2.1 ForecastDay — день прогноза (полный)

```typescript
// src/types/index.ts

export interface ForecastDay {
  date: string;      // "YYYY-MM-DD"
  balance: number;    // баланс на конец дня
  inflows: number;    // доходы за день
  outflows: number;   // расходы за день
}
```

**Пример:**
```json
{
  "date": "2025-03-15",
  "balance": 125000,
  "inflows": 50000,
  "outflows": 35000
}
```

### 2.2 ForecastDayFact — день с фактическими данными

Используется для сравнения «ожидаемый vs факт». В днях без фактических данных поля `null`.

```typescript
// src/types/index.ts

export interface ForecastDayFact {
  date: string;
  balance: number | null;
  inflows: number | null;
  outflows: number | null;
  hasFactData: boolean;  // true, если есть ActualEntry или ManualTransaction
}
```

### 2.3 WhatIfChanges — изменения для сценариев «Что если»

```typescript
// src/types/index.ts

export interface WhatIfChanges {
  incomeGrowthPercent?: number;   // рост доходов, %
  expenseGrowthPercent?: number;  // рост расходов, %
  expenseOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  incomeOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  manualOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  addExpenses?: Array<{ name: string; amount: number; frequency: string; categoryId: string }>;
  addIncomes?: Array<{ name: string; amount: number; frequency: string; categoryId?: string }>;
  addManual?: Array<{ date: string; type: "IN" | "OUT"; amount: number; description?: string }>;
}
```

---

## 3. Источники данных для прогноза

### 3.1 Модели Prisma

| Модель | Назначение |
|--------|------------|
| `RegularExpense` | Регулярные расходы (частота, сумма, категория) |
| `RegularIncome` | Регулярные доходы (частота, сумма, налоги) |
| `ManualTransaction` | Разовые операции IN/OUT на конкретную дату |
| `ProfileMonthlyData` | Суммарный доход/расход по месяцам (YYYY-MM) |
| `ExpectedEntry` | Ожидаемые суммы по периодам (по сущности или MONTHLY_TOTAL) |
| `ActualEntry` | Фактические суммы (по дню, месяцу или диапазону) |

### 3.2 ExpectedEntry — ожидаемые суммы

```prisma
// prisma/schema.prisma

model ExpectedEntry {
  id          String   @id @default(cuid())
  profileId   String
  entityType  String   // "EXPENSE" | "INCOME" | "MONTHLY_TOTAL"
  entityId    String?  // null для MONTHLY_TOTAL
  period      String   // "2025-03" или "2025-03-15"
  amount      Decimal
  confidence  Float?
  source      String   @default("MANUAL") // MANUAL | AUTO_HISTORICAL | AI | SALES_PLAN
  ...
}
```

- `entityType = "MONTHLY_TOTAL"`, `entityId = "income"` или `"expense"` — общий доход/расход за месяц.
- `entityType = "EXPENSE"` / `"INCOME"`, `entityId = id` сущности — ожидаемая сумма по конкретному расходу/доходу.

### 3.3 ActualEntry — фактические суммы

```prisma
model ActualEntry {
  id         String   @id @default(cuid())
  profileId  String
  entityType String   // "EXPENSE" | "INCOME"
  entityId   String   // RegularExpense.id | RegularIncome.id
  period     String   // YYYY-MM | YYYY-MM-DD | "YYYY-MM-DD:YYYY-MM-DD"
  amount     Decimal
  ...
}
```

Форматы `period`:
- `YYYY-MM` — сумма за месяц, распределяется по дням.
- `YYYY-MM-DD` — сумма за конкретный день.
- `YYYY-MM-DD:YYYY-MM-DD` — сумма за диапазон, распределяется по дням.

### 3.4 Иерархия приоритетов для суммы

**Ожидаемые данные (expected-data.ts):**
1. `ExpectedEntry` (entity-specific) или `ExpectedEntry MONTHLY_TOTAL`
2. `expectedData` JSON на сущности (устаревший формат)
3. `seasonalMultiplier × base amount`
4. `base amount / frequency` (dailyAmount)

**Фактические данные (actual-data.ts):**
1. Точное совпадение по дню (`YYYY-MM-DD`)
2. Диапазон (`YYYY-MM-DD:YYYY-MM-DD`)
3. Месяц (`YYYY-MM`) — сумма делится на число дней в месяце

---

## 4. Бэкенд: сервис прогноза

### 4.1 Файл: `src/lib/services/forecast.ts`

#### 4.1.1 computeForecast — основной расчёт прогноза

```typescript
// Вызов
const forecast = await computeForecast(profileId, {
  days: 90,
  startDate: new Date(),
  useExpectedData: true,
  useActualData: true,
  changes: { incomeGrowthPercent: 10 },
  zoneGreenMin: 50000,
  zoneRedMax: -50000,
});
```

**Алгоритм (упрощённо):**

1. **Начальный баланс**  
   Если не передан `initialBalance`, вызывается `computeHistoricalBalance(profileId, день_перед_стартом)`.

2. **Загрузка данных:**
   ```typescript
   const [expenses, incomes, transactions, monthlyData] = await Promise.all([
     prisma.regularExpense.findMany({ where: { profileId }, include: { category: true } }),
     prisma.regularIncome.findMany({ where: { profileId } }),
     prisma.manualTransaction.findMany({ where: { profileId } }),
     prisma.profileMonthlyData.findMany({ where: { profileId } }),
   ]);
   ```

3. **ExpectedEntry и ProfileMonthlyData (при useExpectedData):**
   - `fetchExpectedEntriesBatch()` — ожидаемые суммы по сущностям и MONTHLY_TOTAL.
   - Для месяцев с `ProfileMonthlyData` или `ExpectedEntry MONTHLY_TOTAL` доход/расход распределяется по дням месяца.

4. **Паттерны из фактических данных (expected-from-actual):**
   - При `useExpectedData && !useActualData` вызывается `computeExpectedFromActualPatterns()`.
   - Берутся средние по дню недели (0–6) и дню месяца (1–31) за последние 6 месяцев.
   - Для будущих дней используются эти средние.

5. **Регулярные расходы (expenses):**
   - Для каждого дня в диапазоне:
     - Если есть `ActualEntry` — берётся фактическая сумма.
     - Иначе: `getEffectiveMonthlyAmount()` → `dailyAmountFromFrequency()` → `getSeasonalMultiplier()`.
   - Применяется `expenseMult = 1 + expenseGrowthPercent/100`.

6. **Регулярные доходы (incomes):**
   - Аналогично расходам.
   - Учитываются `expectedData`, `salesPlan`, налоги (`taxes`).
   - Применяется `incomeMult = 1 + incomeGrowthPercent/100`.

7. **Разовые операции (ManualTransaction):**
   - Каждая операция добавляется только в свой день (`date`).
   - IN: `amount * (1 - taxPct) * incomeMult`
   - OUT: `amount * (1 + taxPct) * expenseMult`

8. **WhatIf-изменения:**
   - `addExpenses`, `addIncomes`, `addManual` — добавляются в соответствующие дни.
   - `expenseOverrides`, `incomeOverrides`, `manualOverrides` — подмена сумм или скрытие.

9. **Итоговый баланс по дням:**
   ```typescript
   for (let i = 0; i < days; i++) {
     const inflows = dailyInflows[key] ?? 0;
     const outflows = dailyOutflows[key] ?? 0;
     balance = balance + inflows - outflows;
     result.push({ date: key, balance, inflows, outflows });
   }
   ```

#### 4.1.2 computeForecastActualOnly — только дни с фактом

```typescript
// src/lib/services/forecast.ts, строки 252–391

export async function computeForecastActualOnly(
  profileId: string,
  options: { days?: number; startDate?: Date } = {}
): Promise<ForecastDayFact[]>
```

- Учитываются только `ActualEntry` и `ManualTransaction`.
- Для дней без фактических данных возвращается `{ hasFactData: false, balance: null, inflows: null, outflows: null }`.
- Используется для сравнения «ожидаемый vs факт» на дашборде.

#### 4.1.3 computeHistoricalBalance — баланс на дату

```typescript
// src/lib/services/forecast.ts, строки 40–249

export async function computeHistoricalBalance(
  profileId: string,
  asOfDate: Date,
  options?: { useActualData?: boolean }
): Promise<number>
```

- Строит дневные притоки и оттоки от самой ранней даты до `asOfDate`.
- Учитывает `RegularExpense`, `RegularIncome`, `ManualTransaction`, `ProfileMonthlyData`.
- При `useActualData: true` подставляет `ActualEntry` вместо расчёта по частоте.
- Возвращает итоговый баланс на конец `asOfDate`.

### 4.2 expected-data.ts — расчёт эффективных сумм

```typescript
// src/lib/services/expected-data.ts

// Перевод частоты в дневную сумму
export function dailyAmountFromFrequency(
  freq: string,
  amount: number,
  customDays?: number | null
): number {
  switch (freq) {
    case "DAILY":   return amount;
    case "WEEKLY":  return amount / 7;
    case "MONTHLY": return amount / 30;
    case "QUARTERLY": return amount / 90;
    case "YEARLY":  return amount / 365;
    case "CUSTOM":  return customDays && customDays > 0 ? amount / customDays : 0;
    default:       return amount / 30;
  }
}

// Эффективная сумма за месяц с учётом ExpectedEntry, expectedData, seasonalMultiplier
export function getEffectiveMonthlyAmount(
  entity, period, baseAmount, expectedByEntity, expectedDataJson, useExpectedData
): number
```

### 4.3 actual-data.ts — работа с фактическими данными

```typescript
// src/lib/services/actual-data.ts

export async function fetchActualEntriesBatch(
  profileId: string,
  entityIds: string[],
  startDate: Date,
  endDate: Date
): Promise<ActualByEntity>

// Получить сумму на конкретный день для сущности
export function getActualAmountForDay(
  entityId: string,
  entityType: "EXPENSE" | "INCOME",
  dateKey: string,
  monthKeyStr: string,
  actual: ActualByEntity
): number | null
```

Приоритет: день → диапазон → месяц.

### 4.4 expected-from-actual.ts — паттерны из истории

```typescript
// src/lib/services/expected-from-actual.ts

export async function computeExpectedFromActualPatterns(
  profileId: string,
  options: { days?: number; startDate?: Date } = {}
): Promise<ExpectedFromActualResult>
```

- Берёт данные за последние 6 месяцев (`LOOKBACK_MONTHS`).
- Строит средние по дню недели и дню месяца.
- Для будущих дней: сначала день недели, затем день месяца, затем общее среднее.
- Требует минимум 7 дней с данными (`MIN_DAYS_WITH_DATA`).

---

## 5. Бэкенд: серверные экшены

### 5.1 getForecastAction

```typescript
// src/app/actions/forecast.ts

export async function getForecastAction(
  profileId: string,
  options?: {
    days?: number;
    startDate?: Date | string;
    changes?: WhatIfChanges;
    useExpectedData?: boolean;
    useActualData?: boolean;
    returnBoth?: boolean;  // вернуть и ожидаемый, и факт
  }
)
```

**Логика:**
1. Проверка авторизации и доступа к профилю.
2. Ограничение по тарифу: FREE — 30 дней, PRO — 90 дней.
3. При `returnBoth: true`:
   ```typescript
   const [forecastExpected, forecastFactOnly] = await Promise.all([
     computeForecast(profileId, { ...baseOpts, useActualData: false }),
     computeForecastActualOnly(profileId, { days, startDate }),
   ]);
   return { forecastExpected, forecastFactOnly, zoneGreenMin, zoneRedMax };
   ```
4. Иначе — один вызов `computeForecast()` с `useActualData`.

---

## 6. Фронтенд: где и как отображается прогноз

### 6.1 Dashboard — `src/app/(dashboard)/dashboard/page.tsx`

```typescript
// Текущий месяц
const forecastRes = await getForecastAction(profile.id, {
  startDate: firstOfMonthStr,
  days: daysInMonth,
  useExpectedData: true,
  returnBoth: true,
});
const forecastExpected = forecastRes?.forecastExpected ?? [];
const forecastFactOnly = forecastRes.forecastFactOnly ?? [];

// Следующие 2 месяца (если есть ожидаемые данные)
const expectedForecastRes = await getForecastAction(profile.id, {
  days: Math.max(90, expectedDays + 30),
  useExpectedData: true,
  returnBoth: true,
});
```

Данные передаются в `DashboardCharts`:

```tsx
<DashboardCharts
  dataExpected={forecastExpected}
  dataFact={forecastFactOnly}
  currency={profile.currency}
  section="Нынешние"
/>
```

### 6.2 DashboardCharts — `src/components/dashboard/dashboard-charts.tsx`

Компонент показывает:
- Суммарную прибыль, доход, расход.
- График баланса по дням (ожидаемый и факт).
- График прибыли за день (ожидаемый и факт).
- Кумулятивные доход и расход.

```typescript
// Расчёт прибыли за день
const profit = Math.round(d.inflows - d.outflows);

// Суммарные показатели
const totalIncome = chartData.reduce((s, d) => s + (fact?.inflows ?? d.inflows), 0);
const totalExpense = chartData.reduce((s, d) => s + (fact?.outflows ?? d.outflows), 0);
const totalProfit = totalIncome - totalExpense;
```

### 6.3 CashFlowPlanner — `src/components/cashflow/cashflow-planner.tsx`

```typescript
const loadForecast = async () => {
  const res = await getForecastAction(profile.id, { days: forecastDays });
  if (res?.forecast) {
    setForecast({
      forecast: res.forecast,
      zoneGreenMin: res.zoneGreenMin ?? zoneGreenMin,
      zoneRedMax: res.zoneRedMax ?? zoneRedMax,
    });
  }
};
```

Прогноз вызывается при:
- Переключении на вкладку «График».
- Добавлении/изменении/удалении расходов, доходов, разовых операций, месячных данных.
- Нажатии кнопки «Рассчитать прогноз».

График рендерится через `ForecastChart`:

```tsx
<ForecastChart
  data={forecast.forecast}
  zoneGreenMin={forecast.zoneGreenMin}
  zoneRedMax={forecast.zoneRedMax}
/>
```

### 6.4 ForecastChart — `src/components/cashflow/forecast-chart.tsx`

- Area-график баланса по дням.
- Референсные линии: `zoneGreenMin`, `zoneRedMax`, 0.
- Зелёная зона (баланс ≥ zoneGreenMin), жёлтая, красная (баланс < zoneRedMax).

### 6.5 PlannedIndicators — `src/components/dashboard/planned-indicators.tsx`

Показывает ожидаемую прибыль, доход и расход по месяцам на основе `forecastData` (массив `ForecastDay`):

```typescript
const monthlyData = (() => {
  const byMonth: Record<string, { inflows: number; outflows: number }> = {};
  for (const d of forecastData) {
    const monthKey = d.date.slice(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { inflows: 0, outflows: 0 };
    byMonth[monthKey].inflows += d.inflows;
    byMonth[monthKey].outflows += d.outflows;
  }
  return Object.entries(byMonth).map(([key, v]) => ({
    monthKey: key,
    inflows: v.inflows,
    outflows: v.outflows,
    profit: v.inflows - v.outflows,
  }));
})();
```

### 6.6 WhatIfSimulator — `src/components/what-if/what-if-simulator.tsx`

Сравнивает базовый сценарий и сценарий с изменениями:

```typescript
const buildChanges = (): WhatIfChanges => ({
  incomeGrowthPercent,
  expenseGrowthPercent,
  expenseOverrides: { [id]: { amount, hidden } },
  incomeOverrides: { ... },
  addExpenses: [...],
  addIncomes: [...],
  addManual: [...],
});

// Прогноз без изменений
const baseline = await getForecastAction(profileId, { days, startDate });

// Прогноз с изменениями
const scenario = await getForecastAction(profileId, { days, startDate, changes: buildChanges() });

const totalProfit = (data: ForecastDay[]) =>
  data.reduce((s, d) => s + d.inflows, 0) - data.reduce((s, d) => s + d.outflows, 0);
```

---

## 7. Формулы и расчёты

### 7.1 Прибыль за день

```
profit = inflows - outflows
```

### 7.2 Баланс на конец дня

```
balance[i] = balance[i-1] + inflows[i] - outflows[i]
```

### 7.3 Дневная сумма из частоты

| Частота | Формула |
|---------|---------|
| DAILY | `amount` |
| WEEKLY | `amount / 7` |
| MONTHLY | `amount / 30` |
| QUARTERLY | `amount / 90` |
| YEARLY | `amount / 365` |
| CUSTOM | `amount / customDays` |

### 7.4 Доход с учётом налогов

```
netIncome = grossAmount * (1 - taxPct/100)
```

### 7.5 Расход с учётом НДС (ManualTransaction OUT)

```
totalExpense = amount * (1 + taxPct/100)
```

### 7.6 Сезонность (seasonalMultiplier)

```
effectiveAmount = baseAmount * seasonalMultiplier[month]
// month: "01".."12"
```

### 7.7 WhatIf: рост доходов/расходов

```
incomeMult = 1 + incomeGrowthPercent/100
expenseMult = 1 + expenseGrowthPercent/100

dailyInflows[key] *= incomeMult
dailyOutflows[key] *= expenseMult
```

---

## Сводка файлов

| Файл | Роль |
|------|------|
| `src/lib/services/forecast.ts` | Основной расчёт прогноза |
| `src/lib/services/expected-data.ts` | Ожидаемые суммы, частота, сезонность |
| `src/lib/services/actual-data.ts` | Фактические записи |
| `src/lib/services/expected-from-actual.ts` | Паттерны из истории |
| `src/app/actions/forecast.ts` | Server actions для прогноза |
| `src/types/index.ts` | ForecastDay, ForecastDayFact, WhatIfChanges |
| `src/app/(dashboard)/dashboard/page.tsx` | Страница дашборда, вызов прогноза |
| `src/components/dashboard/dashboard-charts.tsx` | Графики прибыли, дохода, расхода |
| `src/components/cashflow/forecast-chart.tsx` | График баланса |
| `src/components/cashflow/cashflow-planner.tsx` | Планировщик, кнопка «Рассчитать прогноз» |
| `src/components/dashboard/planned-indicators.tsx` | Показатели по месяцам |
| `src/components/what-if/what-if-simulator.tsx` | Симулятор сценариев |
