# Прогноз доходов и прибыли в ffinplaner

Подробное описание реализации прогноза: от источников данных до отображения на фронтенде. Включает адаптивные паттерны, приоритеты данных и логику слияния ожидаемого и фактического.

---

## Содержание

1. [Общая архитектура](#1-общая-архитектура)
2. [Типы данных](#2-типы-данных)
3. [Источники данных для прогноза](#3-источники-данных-для-прогноза)
4. [Бэкенд: сервис прогноза](#4-бэкенд-сервис-прогноза)
5. [Адаптивные паттерны](#5-адаптивные-паттерны)
6. [ProfileMonthlyData и pattern scaling](#6-profilemonthlydata-и-pattern-scaling)
7. [Бэкенд: серверные экшены](#7-бэкенд-серверные-экшены)
8. [Фронтенд: где и как отображается прогноз](#8-фронтенд-где-и-как-отображается-прогноз)
9. [Адаптация графиков под факт](#9-адаптация-графиков-под-факт)
10. [Формирование графиков](#10-формирование-графиков)
11. [Формулы и расчёты](#11-формулы-и-расчёты)
12. [Сводка файлов](#12-сводка-файлов)

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
│  (прибыль, доход, расход,     (баланс по дням,           (baseline vs scenario)│
│   ожидаемый vs факт)           подсказка про паттерны)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER ACTIONS (forecast.ts)                          │
│  getForecastAction(profileId, { days, startDate, changes, useExpectedData,   │
│    useActualData, usePatterns, patternLookbackMonths, returnBoth })          │
│  getForecastDebugAction(profileId)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORECAST SERVICE (lib/services/forecast.ts)               │
│  computeForecast()         — полный прогноз (ожидаемый + факт при useActualData)│
│  computeForecastActualOnly() — только дни с ActualEntry/ManualTransaction   │
│  computeHistoricalBalance()  — баланс на дату из истории                   │
│  getRedZones()            — дни с балансом < zoneRedMax                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐
│ expected-data.ts     │  │ actual-data.ts        │  │ expected-patterns.ts         │
│ Ожидаемые суммы,     │  │ Фактические записи    │  │ buildDailyPatternMap,         │
│ getEffectiveDaily   │  │ (ActualEntry)         │  │ applyMonthlyScaling           │
│ AmountWithPatterns   │  │ fetchActualEntries    │  │ (weekday, monthDay, month     │
│                      │  │ getActualAmountForDay │  │ из ActualEntry + ManualTx +   │
└──────────────────────┘  └──────────────────────┘  │ ProfileMonthlyData)          │
        │                               │             └──────────────────────────────┘
        │                               │                               │
        │                               │                               ▼
        │                               │             ┌──────────────────────────────┐
        │                               │             │ pattern-cache.ts (Upstash)    │
        │                               │             │ Кэш patternMap, TTL 6 часов  │
        │                               │             └──────────────────────────────┘
```

---

## 2. Типы данных

### 2.1 ForecastDay — день прогноза (полный)

```typescript
// src/types/index.ts

export interface ForecastDay {
  date: string; // "YYYY-MM-DD"
  balance: number; // баланс на конец дня
  inflows: number; // доходы за день
  outflows: number; // расходы за день
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
  hasFactData: boolean; // true, если есть ActualEntry или ManualTransaction
}
```

`hasFactData = true`, если хотя бы по одному из inflow или outflow есть фактические данные.

### 2.3 WhatIfChanges — изменения для сценариев «Что если»

```typescript
// src/types/index.ts

export interface WhatIfChanges {
  incomeGrowthPercent?: number;
  expenseGrowthPercent?: number;
  expenseOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  incomeOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  manualOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  addExpenses?: Array<{
    name: string;
    amount: number;
    frequency: string;
    categoryId: string;
  }>;
  addIncomes?: Array<{
    name: string;
    amount: number;
    frequency: string;
    categoryId?: string;
  }>;
  addManual?: Array<{
    date: string;
    type: "IN" | "OUT";
    amount: number;
    description?: string;
  }>;
}
```

---

## 3. Источники данных для прогноза

### 3.1 Модели Prisma

| Модель               | Назначение                                                                       |
| -------------------- | -------------------------------------------------------------------------------- |
| `RegularExpense`     | Регулярные расходы (частота, сумма, категория, expectedData, seasonalMultiplier) |
| `RegularIncome`      | Регулярные доходы (частота, сумма, налоги, expectedData, salesPlan)              |
| `ManualTransaction`  | Разовые операции IN/OUT на конкретную дату                                       |
| `ProfileMonthlyData` | Суммарный доход/расход по месяцам (YYYY-MM)                                      |
| `ExpectedEntry`      | Ожидаемые суммы по периодам (по сущности или MONTHLY_TOTAL)                      |
| `ActualEntry`        | Фактические суммы (по дню, месяцу или диапазону)                                 |

### 3.2 ExpectedEntry — ожидаемые суммы

```prisma
model ExpectedEntry {
  id          String   @id @default(cuid())
  profileId   String
  entityType  String   // "EXPENSE" | "INCOME" | "MONTHLY_TOTAL"
  entityId    String?  // null для MONTHLY_TOTAL
  period      String   // "2025-03" или "2025-03-15"
  amount      Decimal
  confidence  Float?
  source      String   @default("MANUAL")
  ...
}
```

- `entityType = "MONTHLY_TOTAL"`, `entityId = "income"` или `"expense"` — общий доход/расход за месяц.
- `entityType = "EXPENSE"` / `"INCOME"`, `entityId = id` сущности — ожидаемая сумма по конкретному расходу/доходу.
- `period` может быть `YYYY-MM` (месяц) или `YYYY-MM-DD` (конкретный день).

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

- `YYYY-MM` — сумма за месяц, распределяется равномерно по дням.
- `YYYY-MM-DD` — сумма за конкретный день.
- `YYYY-MM-DD:YYYY-MM-DD` — сумма за диапазон, распределяется по дням.

### 3.4 Иерархия приоритетов для дневной суммы

**Ожидаемые данные (getEffectiveDailyAmountWithPatterns):**

| #   | Источник                                                     | Условие                                                  |
| --- | ------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | ExpectedEntry для `dateKey` (YYYY-MM-DD)                     | Точная сумма на день                                     |
| 2   | ExpectedEntry для `monthKey` (YYYY-MM) или expectedData JSON | Распределение по дням месяца                             |
| 3   | patternMap (факторы)                                         | baseDaily × weekdayFactor × monthDayFactor × monthFactor |
| 4   | seasonalMultiplier                                           | baseAmount × mult                                        |
| 5   | dailyAmountFromFrequency                                     | amount / 30, /7 и т.д. (fallback)                        |

**Фактические данные (actual-data.ts):**

| #   | Формат period           | Логика                                          |
| --- | ----------------------- | ----------------------------------------------- |
| 1   | `YYYY-MM-DD`            | Точное совпадение по дню                        |
| 2   | `YYYY-MM-DD:YYYY-MM-DD` | День попадает в диапазон → amount / daysInRange |
| 3   | `YYYY-MM`               | Сумма делится на число дней в месяце            |

---

## 4. Бэкенд: сервис прогноза

### 4.1 computeForecast — основной расчёт

```typescript
// src/lib/services/forecast.ts

export async function computeForecast(
  profileId: string,
  options: {
    days?: number;
    startDate?: Date;
    initialBalance?: number;
    changes?: WhatIfChanges;
    zoneGreenMin?: number;
    zoneRedMax?: number;
    useExpectedData?: boolean;
    useActualData?: boolean;
    usePatterns?: boolean;
    patternLookbackMonths?: number;
  } = {},
): Promise<{
  forecast: ForecastDay[];
  usedPatterns: boolean;
  hasEnoughPatternData: boolean;
}>;
```

**Порядок выполнения:**

1. **Начальный баланс**  
   Если не передан `initialBalance`, вызывается `computeHistoricalBalance(profileId, день_перед_стартом)`.

2. **Загрузка данных:**

   ```typescript
   const [expenses, incomes, transactions, monthlyData] = await Promise.all([
     prisma.regularExpense.findMany({
       where: { profileId },
       include: { category: true },
     }),
     prisma.regularIncome.findMany({ where: { profileId } }),
     prisma.manualTransaction.findMany({ where: { profileId } }),
     prisma.profileMonthlyData.findMany({ where: { profileId } }),
   ]);
   ```

3. **ExpectedEntry и ProfileMonthlyData (при useExpectedData):**
   - `fetchExpectedEntriesBatch(profileId, monthKeys, entityIds, dateKeys)` — ожидаемые суммы по сущностям, MONTHLY_TOTAL и дневным периодам.
   - ExpectedEntry MONTHLY_TOTAL объединяется с ProfileMonthlyData в `monthlyByMonth`.

4. **Паттерны (expected-patterns.ts):**
   - При `useExpectedData && (usePatterns ?? true)` — попытка `getCachedPatternMap()`; при промахе вызывается `buildDailyPatternMap()`, результат кэшируется (Upstash, TTL 6 ч).
   - Lookback: 12 месяцев по умолчанию (`patternLookbackMonths`).
   - Минимум 30 дней с данными, иначе паттерны не применяются.

5. **ProfileMonthlyData / ExpectedEntry MONTHLY_TOTAL (applyMonthlyScaling):**
   - Вызывается `applyMonthlyScaling(patternMap, monthlyByMonth, ...)` — pattern-based распределение с масштабированием до целевой суммы за месяц.
   - При отсутствии patternMap — равномерное распределение (`target / daysInMonth`).
   - Циклы RegularExpense и RegularIncome **пропускают** день только если для этого типа есть явные данные: `monthly.expense > 0` или `monthly.income > 0`.

6. **Регулярные расходы (expenses):**
   - Для каждого дня: если `monthly && monthly.expense > 0` — пропуск (уже учтено).
   - Иначе: при `useActualData && actualAmt != null` — факт; иначе `getEffectiveDailyAmountWithPatterns(..., "OUT", ...)`.
   - Применяется `expenseMult = 1 + expenseGrowthPercent/100`.

7. **Регулярные доходы (incomes):**
   - Аналогично: пропуск при `monthly && monthly.income > 0`.
   - Учитываются `salesPlan`, налоги, `getEffectiveDailyAmountWithPatterns(..., "IN", ...)`.
   - Применяется `incomeMult`.

8. **Разовые операции (ManualTransaction):**
   - Каждая операция добавляется только в свой день.
   - IN: `amount * (1 - taxPct) * incomeMult`
   - OUT: `amount * (1 + taxPct) * expenseMult`

9. **WhatIf-изменения:**
   - `addExpenses`, `addIncomes`, `addManual` — добавляются в дни.
   - `expenseOverrides`, `incomeOverrides`, `manualOverrides` — подмена или скрытие.

10. **Итоговый баланс по дням:**
    ```typescript
    for (let i = 0; i < days; i++) {
      const inflows = dailyInflows[key] ?? 0;
      const outflows = dailyOutflows[key] ?? 0;
      balance = balance + inflows - outflows;
      result.push({ date: key, balance, inflows, outflows });
    }
    return {
      forecast: result,
      usedPatterns: patternMap != null,
      hasEnoughPatternData: patternResult?.hasEnoughData ?? false,
    };
    ```

### 4.2 computeForecastActualOnly — только дни с фактом

```typescript
export async function computeForecastActualOnly(
  profileId: string,
  options: { days?: number; startDate?: Date } = {},
): Promise<ForecastDayFact[]>;
```

- Учитываются только `ActualEntry` и `ManualTransaction`.
- Для каждого дня: `hasFactData = hasFactInflows || hasFactOutflows`.
- При `hasFactData`: `inflows`, `outflows`, `balance` — кумулятивно по факту.
- При `!hasFactData`: `balance: null`, `inflows: null`, `outflows: null`.

### 4.3 computeHistoricalBalance — баланс на дату

```typescript
export async function computeHistoricalBalance(
  profileId: string,
  asOfDate: Date,
  options?: { useActualData?: boolean },
): Promise<number>;
```

- Строит дневные притоки и оттоки от самой ранней даты до `asOfDate`.
- Учитывает RegularExpense, RegularIncome, ManualTransaction, ProfileMonthlyData.
- При `useActualData: true` подставляет ActualEntry.
- Логика частичного переопределения ProfileMonthlyData та же: пропуск expense только при `monthly.expense > 0`, income — при `monthly.income > 0`.

### 4.4 expected-data.ts — расчёт эффективных сумм

```typescript
// Перевод частоты в дневную сумму
export function dailyAmountFromFrequency(
  freq: string,
  amount: number,
  customDays?: number | null
): number

// Эффективная сумма за месяц (ExpectedEntry, expectedData)
export function getEffectiveMonthlyAmount(...): number

// Дневная сумма с учётом паттернов (основная функция для прогноза)
export function getEffectiveDailyAmountWithPatterns(
  entity, dateKey, date, flowType, patternMap, baseAmount,
  expectedByEntity, expectedDataJson, usePatterns, useExpectedData,
  freq, customDays, taxPct?
): number
```

### 4.5 actual-data.ts — работа с фактическими данными

```typescript
export async function fetchActualEntriesBatch(
  profileId: string,
  entityIds: string[],
  startDate: Date,
  endDate: Date,
): Promise<ActualByEntity>;

export function getActualAmountForDay(
  entityId: string,
  entityType: "EXPENSE" | "INCOME",
  dateKey: string,
  monthKeyStr: string,
  actual: ActualByEntity,
): number | null;
```

Приоритет: день → диапазон → месяц.

---

## 5. Адаптивные паттерны

### 5.1 expected-patterns.ts — buildDailyPatternMap

```typescript
// src/lib/services/expected-patterns.ts

export async function buildDailyPatternMap(
  profileId: string,
  startDate: Date,
  days: number,
  options?: { patternLookbackMonths?: number },
): Promise<{
  patternMap: Map<string, PatternMapEntry>;
  hasEnoughData: boolean;
  daysWithData: number;
}>;
```

**Алгоритм:**

1. Загрузка за последние 365 дней (или `patternLookbackMonths * 30`):
   - ActualEntry — через `fetchActualEntriesBatch` + развёртка по дням
   - ManualTransaction — IN/OUT по дате
   - ProfileMonthlyData — распределение income/expense по дням месяца

2. Для каждого дня: `dailyInflows[key]`, `dailyOutflows[key]`.

3. Средние: `avgDailyIn = totalIn / daysWithData`, `avgDailyOut = totalOut / daysWithData`.

4. Отклонения: `deviation = actualAmount / avgDaily` (отдельно для inflow/outflow).

5. Три фактора (отдельно для inflow и outflow):
   - `weekdayFactor[0..6]` — среднее отклонение по дню недели
   - `monthDayFactor[1..31]` — по числу месяца
   - `monthFactor["01".."12"]` — по месяцу

6. Нормализация: среднее по каждому фактору = 1.0.

7. Для каждого дня в диапазоне прогноза: `{ inflow: { weekdayFactor, monthDayFactor, monthFactor }, outflow: {...} }`.

**Константы:**

- `MIN_DAYS_WITH_DATA = 30` — при меньшем числе дней с данными возвращается пустая карта.

**Применение:**

```
effectiveDaily = baseDaily * seasonal * weekdayFactor * monthDayFactor * monthFactor
```

### 5.2 expected-from-actual.ts (deprecated)

Файл `expected-from-actual.ts` помечен как `@deprecated`. Логика перенесена в `expected-patterns.ts`. `computeExpectedFromActualPatterns` больше не вызывается из `forecast.ts`.

---

## 6. ProfileMonthlyData и pattern scaling

При наличии `ProfileMonthlyData` или `ExpectedEntry MONTHLY_TOTAL` для месяца используется **pattern scaling** (вместо равномерного распределения):

### 6.1 applyMonthlyScaling (expected-patterns.ts)

Для каждого месяца с `monthly.income > 0` или `monthly.expense > 0`:

1. **Shape по дням:** `shape[day] = weekdayFactor × monthDayFactor × monthFactor` (из patternMap для inflow/outflow).
2. **Сумма:** `patternMonthlySum = Σ shape` по дням месяца в диапазоне прогноза.
3. **Масштаб:** `scaleFactor = targetMonthly / patternMonthlySum`.
4. **Дневные суммы:** `daily[key] = shape[key] × scaleFactor`.

При `!patternMap` или пустой карте: `shape = 1` для всех дней → равномерное распределение (fallback).

### 6.2 Частичное переопределение

- **Доход:** если `monthly.income > 0`, добавляется результат scaling и цикл RegularIncome **пропускается**.
- **Расход:** если `monthly.expense > 0`, добавляется результат scaling и цикл RegularExpense **пропускается**.

Если указан только доход (expense = 0): добавляется только доход из scaling; расходы — из RegularExpense.

Если указан только расход (income = 0): добавляется только расход из scaling; доходы — из RegularIncome.

---

## 7. Бэкенд: серверные экшены

### 7.1 getForecastAction

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
    usePatterns?: boolean;
    patternLookbackMonths?: number;
    returnBoth?: boolean;
  },
);
```

**Логика:**

1. Проверка авторизации и доступа к профилю.
2. Ограничение по тарифу: FREE — 30 дней, PRO — 90 дней.
3. При `returnBoth: true`:
   ```typescript
   const [forecastRes, forecastFactOnly] = await Promise.all([
     computeForecast(profileId, { ...baseOpts, useActualData: true }),
     computeForecastActualOnly(profileId, { days, startDate }),
   ]);
   return {
     forecastExpected: forecastRes.forecast,
     forecastFactOnly,
     zoneGreenMin,
     zoneRedMax,
     usedPatterns: forecastRes.usedPatterns,
     hasEnoughPatternData: forecastRes.hasEnoughPatternData,
   };
   ```
4. Иначе — один вызов `computeForecast()` с переданным `useActualData`.

**Возвращаемые поля:**

- `forecast`, `forecastExpected`, `forecastFactOnly`, `zoneGreenMin`, `zoneRedMax`
- `usedPatterns: boolean` — применялись ли паттерны
- `hasEnoughPatternData: boolean` — достаточно ли данных (≥30 дней) для паттернов

**Дефолты:**

- `usePatterns: true`
- `patternLookbackMonths: 12`

---

## 8. Фронтенд: где и как отображается прогноз

### 8.1 Dashboard — `src/app/(dashboard)/dashboard/page.tsx`

```typescript
const forecastRes = await getForecastAction(profile.id, {
  startDate: firstOfMonthStr,
  days: daysInMonth,
  useExpectedData: true,
  returnBoth: true,
});
const forecastExpected = forecastRes?.forecastExpected ?? [];
const forecastFactOnly = forecastRes.forecastFactOnly ?? [];
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

### 8.2 DashboardCharts — `src/components/dashboard/dashboard-charts.tsx`

- Суммарная прибыль, доход, расход (с учётом факта, когда есть).
- График баланса по дням (ожидаемый и факт).
- График прибыли за день (ожидаемый и факт).
- Кумулятивные доход и расход.

### 8.3 CashFlowPlanner — `src/components/cashflow/cashflow-planner.tsx`

```typescript
const loadForecast = async () => {
  const res = await getForecastAction(profile.id, { days: forecastDays });
  if (res?.forecast) {
    setForecast({ forecast: res.forecast, zoneGreenMin, zoneRedMax });
  }
};
```

Прогноз вызывается при переключении на вкладку «График», при изменении данных и по кнопке «Рассчитать прогноз».

### 8.4 ForecastChart — `src/components/cashflow/forecast-chart.tsx`

- Area-график баланса по дням.
- Референсные линии: `zoneGreenMin`, `zoneRedMax`, 0.
- Проп `showPatternHint` (default: true) — подсказка: «Прогноз адаптирован по дням недели и месяцам на основе ваших фактических данных».

### 8.5 WhatIfSimulator — `src/components/what-if/what-if-simulator.tsx`

Сравнивает базовый сценарий и сценарий с изменениями через `getForecastAction` с `changes`.

---

## 9. Адаптация графиков под факт

### 9.1 Ожидаемая линия

При `returnBoth: true` вызывается `computeForecast(..., useActualData: true)`. Линия «Ожидаемый» подставляет ActualEntry и ManualTransaction на днях, где они есть, и прогноз — на остальных.

### 9.2 Линия факта (DashboardCharts)

- `balanceFact` берётся напрямую из `fact.balance` (из `computeForecastActualOnly`).
- `profitFact`, `cumulativeInflowsFact`, `cumulativeOutflowsFact` обновляются только в дни с `fact?.hasFactData`.
- В дни без факта кумулятивы и баланс факта не продвигаются ожидаемыми значениями — линия факта строится только по фактическим данным.

### 9.3 Сводные показатели

```typescript
const totalIncome = chartData.reduce((s, d) => {
  const fact = factByDateForTotals?.get(d.date);
  const inflows =
    fact?.hasFactData && fact.inflows != null ? fact.inflows : d.inflows;
  return s + inflows;
}, 0);
const totalExpense = chartData.reduce((s, d) => {
  const fact = factByDateForTotals?.get(d.date);
  const outflows =
    fact?.hasFactData && fact.outflows != null ? fact.outflows : d.outflows;
  return s + outflows;
}, 0);
```

---

## 10. Формирование графиков

Подробное описание того, как из `ForecastDay[]` и `ForecastDayFact[]` строятся визуальные графики. Используется библиотека **Recharts**.

### 10.1 Структура ChartPoint (DashboardCharts)

Каждая точка графика — объект `ChartPoint`, расширяющий `ForecastDay`:

```typescript
type ChartPoint = ForecastDay & {
  dateShort: string; // "ДД.ММ.ГГГГ" для оси X
  profit: number; // inflows - outflows
  profitPositive: number; // profit >= 0 ? profit : 0
  profitNegative: number; // profit < 0 ? profit : 0
  positiveBalance: number; // balance >= 0 ? balance : 0
  negativeBalance: number; // balance < 0 ? balance : 0
  cumulativeInflows: number; // нарастающий итог доходов
  cumulativeOutflows: number; // нарастающий итог расходов
  // Ожидаемые значения (всегда заполнены)
  balanceExpected?: number;
  profitExpected?: number;
  cumulativeInflowsExpected?: number;
  cumulativeOutflowsExpected?: number;
  // Фактические (null в дни без hasFactData)
  balanceFact?: number | null;
  profitFact?: number | null;
  cumulativeInflowsFact?: number | null;
  cumulativeOutflowsFact?: number | null;
};
```

### 10.2 Подготовка baseChartData

Итерация по `dataExpected` (прогноз с `useActualData: true`):

1. **Для каждого дня:**
   - `profit = inflows - outflows`
   - `cumulativeInflows = prev.cumulativeInflows + inflows` (нарастающий итог)
   - `cumulativeOutflows = prev.cumulativeOutflows + outflows`
   - `dateShort = formatDateDdMmYyyy(date)` — для подписей оси X
   - `profitPositive` / `profitNegative` — для Area (положительная/отрицательная часть)
   - `positiveBalance` / `negativeBalance` — аналогично для баланса

2. **Слияние с фактом (dataFact):**
   - `factByDate = Map<date, ForecastDayFact>`
   - Если `fact?.hasFactData`:
     - `profitFact = fact.inflows - fact.outflows`
     - `lastCumInFact += fact.inflows`, `lastCumOutFact += fact.outflows`
     - `cumulativeInflowsFact`, `cumulativeOutflowsFact` — кумулятивы **только по фактическим дням**
     - `balanceFact = fact.balance`
   - Иначе: `profitFact`, `cumulativeInflowsFact`, `cumulativeOutflowsFact`, `balanceFact` = `null`

3. **Важно:** кумулятивы факта (`lastCumInFact`, `lastCumOutFact`) обновляются **только** в дни с `hasFactData`. В дни без факта линия факта прерывается (`connectNulls={false}`).

### 10.3 insertZeroCrossings — точки пересечения нуля

Чтобы Area-графики корректно отображали переход через ноль (например, баланс с плюса на минус), между соседними точками вставляется **интерполированная точка** с нулевым значением.

**Алгоритм:**

```
Для каждой пары (a, b):
  va = getValue(a), vb = getValue(b)
  Если va > 0 и vb < 0 (или va < 0 и vb > 0):
    t = va / (va - vb)   // доля пути до нуля
    midDate = a.date + t * (b.date - a.date)
    Вставить точку { ...a, date: midDate, value: 0 }
```

Используется в двух вариантах:

- `chartDataWithProfitCrossings` — для графика «Прибыль за день» (пересечение `profit`)
- `chartDataWithBalanceCrossings` — для графика «Баланс» (пересечение `balance`)

### 10.4 Графики DashboardCharts

#### 10.4.1 Карточки сводных показателей

| Показатель        | Формула                                              |
| ----------------- | ---------------------------------------------------- |
| Суммарная прибыль | `totalIncome - totalExpense`                         |
| Суммарный доход   | `Σ (fact?.hasFactData ? fact.inflows : d.inflows)`   |
| Суммарный расход  | `Σ (fact?.hasFactData ? fact.outflows : d.outflows)` |

При наличии факта на день используется факт, иначе — ожидаемое значение.

#### 10.4.2 График «Баланс» (Прибыль за месяц)

- **Данные:** `chartDataWithBalanceCrossings` (с точками пересечения нуля)
- **Ось X:** `dateShort`
- **Ось Y:** баланс
- **Линии:**
  - `balanceExpected` — пунктир, серый («Ожидаемый»)
  - `balanceFact` — сплошная, зелёная («Факт»), `connectNulls={false}`
- **Area:**
  - `positiveBalance` — зелёная заливка (баланс ≥ 0)
  - `negativeBalance` — красная заливка (баланс < 0)
- **ReferenceLine:** y=0
- **ReferenceArea:** красные зоны для периодов с отрицательным балансом (`negativePeriods`)
- **Tooltip:** дата, ожидаемый баланс, факт (если есть)

**Период восстановления:** последовательные дни с `balance < 0` объединяются в интервалы `{ start, end }` и подсвечиваются.

#### 10.4.3 График «Прибыль за день»

- **Данные:** `chartDataWithProfitCrossings`
- **Линии:** `profitExpected` (пунктир), `profitFact` (сплошная, `connectNulls={false}`)
- **Area:** `profitPositive` (зелёная), `profitNegative` (красная)
- **ReferenceLine:** y=0
- **Tooltip:** дата, ожидаемая прибыль, факт

#### 10.4.4 График «Доход» (кумулятивный)

- **Данные:** `chartData` (без zero-crossings)
- **Линии:** `cumulativeInflowsExpected`, `cumulativeInflowsFact`
- **Area:** `cumulativeInflows` — зелёная заливка под линией ожидаемого
- **Tooltip:** дата, ожидаемый кумулятив, факт, «За день: inflows»

#### 10.4.5 График «Расход» (кумулятивный)

- Аналогично доходу, но `cumulativeOutflows`, красная заливка, `cumulativeOutflowsFact`.

### 10.5 ForecastChart (CashFlowPlanner)

- **Вход:** `ForecastDay[]` (только ожидаемый прогноз, без факта)
- **Подготовка:**
  ```typescript
  chartData = insertZeroCrossings(
    data.map((d) => {
      const balance = Math.round(d.balance);
      return {
        ...d,
        balance,
        dateShort: formatDateDdMmYyyy(d.date),
        positiveBalance: balance >= 0 ? balance : 0,
        negativeBalance: balance < 0 ? balance : 0,
      };
    }),
  );
  ```
- **Тип:** ComposedChart (Area)
- **Area:** `positiveBalance` (зелёная), `negativeBalance` (красная)
- **ReferenceLine:** `zoneGreenMin`, `zoneRedMax`, 0
- **Подсказка (showPatternHint):** «Прогноз адаптирован по дням недели и месяцам на основе ваших фактических данных»
- **Легенда зон:** зелёная ≥ zoneGreenMin, жёлтая между zoneRedMax и zoneGreenMin, красная < zoneRedMax

### 10.6 PlannedIndicators — показатели и столбчатые графики

#### 10.6.1 Карточки ожидаемых показателей

Рассчитываются из `regularExpenses` и `regularIncomes` (не из прогноза):

- **Ожидаемая прибыль:** `expectedIncome - expectedExpense` (в месяц)
- **Ожидаемый доход:** сумма по частотам (MONTHLY, WEEKLY и т.д.) или salesPlan
- **Ожидаемый расход:** сумма RegularExpense с учётом частоты

#### 10.6.2 Агрегация по месяцам (monthlyData)

```typescript
for (const d of forecastData) {
  const monthKey = d.date.slice(0, 7); // "YYYY-MM"
  byMonth[monthKey].inflows += d.inflows;
  byMonth[monthKey].outflows += d.outflows;
}
// profit = inflows - outflows
```

#### 10.6.3 BarChart «Прибыль по месяцам»

- **Данные:** `monthlyData` (month, inflows, outflows, profit)
- **Bar:** `profit`, цвет по знаку (зелёный ≥ 0, красный < 0)

#### 10.6.4 BarChart «Доход по месяцам»

- **Bar:** `inflows`, зелёный

#### 10.6.5 BarChart «Расход по месяцам»

- **Bar:** `outflows`, красный

### 10.7 Сводка компонентов Recharts

| Компонент                 | Использование                                                                |
| ------------------------- | ---------------------------------------------------------------------------- |
| AreaChart / ComposedChart | Баланс, прибыль, кумулятивные доход/расход                                   |
| BarChart                  | Прибыль/доход/расход по месяцам (PlannedIndicators)                          |
| Line                      | Ожидаемый vs Факт (balanceExpected, balanceFact, profitExpected, profitFact) |
| Area                      | Заливка под кривой (positiveBalance, negativeBalance, cumulativeInflows)     |
| ReferenceLine             | y=0, zoneGreenMin, zoneRedMax                                                |
| ReferenceArea             | Периоды с отрицательным балансом                                             |
| XAxis                     | dateShort или month                                                          |
| YAxis                     | Числовые значения, tickFormatter для локализации                             |
| Tooltip                   | Кастомный контент с датой, ожидаемым, фактом                                 |
| Legend                    | Подписи линий                                                                |
| CartesianGrid             | Сетка                                                                        |

---

## 11. Формулы и расчёты

### 11.1 Прибыль за день

```
profit = inflows - outflows
```

### 11.2 Баланс на конец дня

```
balance[i] = balance[i-1] + inflows[i] - outflows[i]
```

### 11.3 Дневная сумма из частоты

| Частота   | Формула               |
| --------- | --------------------- |
| DAILY     | `amount`              |
| WEEKLY    | `amount / 7`          |
| MONTHLY   | `amount / 30`         |
| QUARTERLY | `amount / 90`         |
| YEARLY    | `amount / 365`        |
| CUSTOM    | `amount / customDays` |

### 11.4 Доход с учётом налогов

```
netIncome = grossAmount * (1 - taxPct/100)
```

### 11.5 Расход с учётом НДС (ManualTransaction OUT)

```
totalExpense = amount * (1 + taxPct/100)
```

### 11.6 Сезонность (seasonalMultiplier)

```
effectiveAmount = baseAmount * seasonalMultiplier[month]
// month: "01".."12"
```

### 11.7 Адаптивные паттерны

```
effectiveDaily = baseDaily * seasonal * weekdayFactor * monthDayFactor * monthFactor
```

### 11.8 WhatIf: рост доходов/расходов

```
incomeMult = 1 + incomeGrowthPercent/100
expenseMult = 1 + expenseGrowthPercent/100

dailyInflows[key] *= incomeMult
dailyOutflows[key] *= expenseMult
```

---

## 12. Сводка файлов

| Файл                                              | Роль                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/services/forecast.ts`                    | Основной расчёт прогноза, computeHistoricalBalance, computeForecastActualOnly   |
| `src/lib/services/expected-data.ts`               | Ожидаемые суммы, getEffectiveDailyAmountWithPatterns, fetchExpectedEntriesBatch |
| `src/lib/services/expected-patterns.ts`           | Адаптивные паттерны, buildDailyPatternMap, applyMonthlyScaling                  |
| `src/lib/pattern-cache.ts`                        | Кэш patternMap (Upstash Redis, TTL 6 ч)                                         |
| `src/lib/services/actual-data.ts`                 | Фактические записи, fetchActualEntriesBatch, getActualAmountForDay              |
| `src/lib/services/expected-from-actual.ts`        | Deprecated, логика в expected-patterns                                          |
| `src/app/actions/forecast.ts`                     | Server actions для прогноза                                                     |
| `src/types/index.ts`                              | ForecastDay, ForecastDayFact, WhatIfChanges                                     |
| `src/app/(dashboard)/dashboard/page.tsx`          | Страница дашборда, вызов прогноза                                               |
| `src/components/dashboard/dashboard-charts.tsx`   | Графики прибыли, дохода, расхода, ожидаемый vs факт                             |
| `src/components/cashflow/forecast-chart.tsx`      | График баланса, подсказка про паттерны                                          |
| `src/components/cashflow/cashflow-planner.tsx`    | Планировщик, кнопка «Рассчитать прогноз»                                        |
| `src/components/dashboard/planned-indicators.tsx` | Показатели по месяцам                                                           |
| `src/components/what-if/what-if-simulator.tsx`    | Симулятор сценариев                                                             |
