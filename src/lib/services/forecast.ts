import { prisma } from "@/lib/prisma";
import type { ForecastDay, ForecastDayFact, WhatIfChanges } from "@/types";
import {
  daysInMonth,
  monthKey,
  dailyAmountFromFrequency,
  fetchExpectedEntriesBatch,
  getEffectiveMonthlyAmount,
  getEffectiveDailyAmountForMonth,
  getSeasonalMultiplier,
} from "./expected-data";
import {
  fetchActualEntriesBatch,
  getActualAmountForDay,
  type ActualByEntity,
} from "./actual-data";
import { computeExpectedFromActualPatterns } from "./expected-from-actual";

export function getZone(
  balance: number,
  zoneGreenMin = 50000,
  zoneRedMax = -50000
): "green" | "yellow" | "red" {
  if (balance >= zoneGreenMin) return "green";
  if (balance >= zoneRedMax) return "yellow";
  return "red";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** @deprecated Use dailyAmountFromFrequency from expected-data */
function dailyAmount(freq: string, amount: number, customDays?: number | null): number {
  return dailyAmountFromFrequency(freq, amount, customDays);
}

/** Compute balance at end of asOfDate from historical data (manual tx + expectedData for past months). */
export async function computeHistoricalBalance(
  profileId: string,
  asOfDate: Date,
  options?: { useActualData?: boolean }
): Promise<number> {
  const useActualData = options?.useActualData ?? true;
  const asOf = new Date(asOfDate);
  asOf.setHours(23, 59, 59, 999);

  const [expenses, incomes, transactions, monthlyData] = await Promise.all([
    prisma.regularExpense.findMany({
      where: { profileId },
      include: { category: true },
    }),
    prisma.regularIncome.findMany({ where: { profileId } }),
    prisma.manualTransaction.findMany({
      where: { profileId },
    }),
    prisma.profileMonthlyData.findMany({ where: { profileId } }),
  ]);

  const monthlyByMonth = new Map(monthlyData.map((m) => [m.month, { income: Number(m.income), expense: Number(m.expense) }]));

  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const earliestExpense = expenses.reduce<Date | null>((acc, e) => {
    const d = new Date(e.startDate);
    return !acc || d < acc ? d : acc;
  }, null);
  const earliestIncome = incomes.reduce<Date | null>((acc, i) => {
    const d = i.startDate ? new Date(i.startDate) : new Date(0);
    return !acc || d < acc ? d : acc;
  }, null);
  const earliestManual = transactions.reduce<Date | null>((acc, t) => {
    const d = typeof t.date === "string" ? new Date(t.date) : t.date;
    return !acc || d < acc ? d : acc;
  }, null);
  const earliestMonthly = monthlyData.length > 0
    ? monthlyData.reduce<Date | null>((acc, m) => {
        const [y, mo] = m.month.split("-").map(Number);
        const d = new Date(y, mo - 1, 1);
        return !acc || d < acc ? d : acc;
      }, null)
    : null;

  const startCandidates = [earliestExpense, earliestIncome, earliestManual, earliestMonthly].filter(Boolean) as Date[];
  const startDate = startCandidates.length > 0
    ? new Date(Math.min(...startCandidates.map((d) => d.getTime())))
    : new Date(asOf);
  startDate.setHours(0, 0, 0, 0);

  if (startDate > asOf) return 0;

  const days = Math.ceil((asOf.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const dailyInflows: Record<string, number> = {};
  const dailyOutflows: Record<string, number> = {};

  let actualByEntity: ActualByEntity | null = null;
  if (useActualData) {
    const entityIds = [...expenses.map((e) => e.id), ...incomes.map((i) => i.id)];
    const endDate = addDays(startDate, days - 1);
    actualByEntity = await fetchActualEntriesBatch(profileId, entityIds, startDate, endDate);
  }

  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    if (d > asOf) continue;
    const mk = monthKey(d);
    const monthly = monthlyByMonth.get(mk);
    if (monthly) {
      const days = daysInMonth(d);
      const perDayIn = days > 0 ? monthly.income / days : 0;
      const perDayOut = days > 0 ? monthly.expense / days : 0;
      const key = dateKey(d);
      if (perDayIn > 0) dailyInflows[key] = (dailyInflows[key] ?? 0) + perDayIn;
      if (perDayOut > 0) dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDayOut;
    }
  }

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    const freq = exp.frequency as string;
    const expectedData = exp.expectedData as Record<string, number> | null | undefined;
    const expStart = new Date(exp.startDate);
    expStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < expStart || d > asOf) continue;
      const mk = monthKey(d);
      if (monthlyByMonth.has(mk)) continue;
      const key = dateKey(d);
      let perDay: number;
      if (useActualData && actualByEntity) {
        const actualAmt = getActualAmountForDay(exp.id, "EXPENSE", key, mk, actualByEntity);
        if (actualAmt != null) {
          perDay = actualAmt;
        } else {
          let useAmount = amount;
          if (expectedData) {
            const expected = expectedData[mk];
            if (expected != null && !Number.isNaN(expected)) useAmount = expected;
          }
          perDay = dailyAmountFromFrequency(freq, useAmount, exp.customDays);
        }
      } else {
        let useAmount = amount;
        if (expectedData) {
          const expected = expectedData[mk];
          if (expected != null && !Number.isNaN(expected)) useAmount = expected;
        }
        perDay = dailyAmountFromFrequency(freq, useAmount, exp.customDays);
      }
      if (perDay <= 0) continue;
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDay;
    }
  }

  for (const inc of incomes) {
    const grossAmt = Number(inc.amount ?? inc.avgCheck ?? 0);
    const taxPct = Number(inc.taxes ?? 0) / 100;
    const amt = grossAmt * (1 - taxPct);
    const expectedData = inc.expectedData as Record<string, number> | null | undefined;
    const incStart = inc.startDate ? new Date(inc.startDate) : startDate;
    incStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < incStart || d > asOf) continue;
      const mk = monthKey(d);
      if (monthlyByMonth.has(mk)) continue;
      const key = dateKey(d);
      let perDay: number;
      if (useActualData && actualByEntity) {
        const actualAmt = getActualAmountForDay(inc.id, "INCOME", key, mk, actualByEntity);
        if (actualAmt != null) {
          perDay = actualAmt * (1 - taxPct);
        } else if (expectedData && Object.keys(expectedData).length > 0) {
          const expected = expectedData[mk];
          const grossExpected = expected != null && !Number.isNaN(expected) ? expected : grossAmt;
          const netExpected = grossExpected * (1 - taxPct);
          const dInMonth = daysInMonth(d);
          perDay = dInMonth > 0 ? netExpected / dInMonth : 0;
        } else if (amt > 0) {
          const freq = inc.frequency as string;
          perDay = dailyAmountFromFrequency(freq, amt, inc.customDays);
        } else {
          perDay = 0;
        }
      } else {
        if (expectedData && Object.keys(expectedData).length > 0) {
          const expected = expectedData[mk];
          const grossExpected = expected != null && !Number.isNaN(expected) ? expected : grossAmt;
          const netExpected = grossExpected * (1 - taxPct);
          const dInMonth = daysInMonth(d);
          perDay = dInMonth > 0 ? netExpected / dInMonth : 0;
        } else if (amt > 0) {
          const freq = inc.frequency as string;
          perDay = dailyAmountFromFrequency(freq, amt, inc.customDays);
        } else {
          perDay = 0;
        }
      }
      if (perDay > 0) {
        dailyInflows[key] = (dailyInflows[key] ?? 0) + perDay;
      }
    }
  }

  const toDateKey = (d: Date | string): string => {
    if (typeof d === "string") return d.slice(0, 10);
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const asOfOnly = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());

  for (const tx of transactions) {
    if (tx.type !== "IN" && tx.type !== "OUT") continue;
    const txDate = typeof tx.date === "string" ? new Date(tx.date) : tx.date;
    const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    if (txDateOnly < startDateOnly || txDateOnly > asOfOnly) continue;
    const txKey = toDateKey(tx.date);
    const amount = Number(tx.amount);
    const taxPct = Number(tx.taxes ?? 0) / 100;
    if (tx.type === "IN") {
      const netAmount = amount * (1 - taxPct);
      dailyInflows[txKey] = (dailyInflows[txKey] ?? 0) + netAmount;
    } else {
      const totalAmount = amount * (1 + taxPct);
      dailyOutflows[txKey] = (dailyOutflows[txKey] ?? 0) + totalAmount;
    }
  }

  const asOfMidnight = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  let balance = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    if (d > asOfMidnight) break;
    const key = dateKey(d);
    const inflows = dailyInflows[key] ?? 0;
    const outflows = dailyOutflows[key] ?? 0;
    balance = balance + inflows - outflows;
  }
  return balance;
}

/** Compute daily flows from ACTUAL data only (ActualEntry + ManualTransaction). Returns null for days without data. */
export async function computeForecastActualOnly(
  profileId: string,
  options: {
    days?: number;
    startDate?: Date;
  } = {}
): Promise<ForecastDayFact[]> {
  const days = options.days ?? 90;
  const startDate = options.startDate ? (() => {
    const d = new Date(options.startDate);
    d.setHours(0, 0, 0, 0);
    return d;
  })() : (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const endDate = addDays(startDate, days);

  const dailyInflows: Record<string, number> = {};
  const dailyOutflows: Record<string, number> = {};
  const hasFactInflowsByDay: Record<string, boolean> = {};
  const hasFactOutflowsByDay: Record<string, boolean> = {};

  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const toDateKey = (d: Date | string): string => {
    if (typeof d === "string") return d.slice(0, 10);
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };

  const [expenses, incomes, transactions, actualByEntity] = await Promise.all([
    prisma.regularExpense.findMany({ where: { profileId } }),
    prisma.regularIncome.findMany({ where: { profileId } }),
    prisma.manualTransaction.findMany({ where: { profileId } }),
    (async () => {
      const entityIds = [
        ...(await prisma.regularExpense.findMany({ where: { profileId }, select: { id: true } })).map((e) => e.id),
        ...(await prisma.regularIncome.findMany({ where: { profileId }, select: { id: true } })).map((i) => i.id),
      ];
      return fetchActualEntriesBatch(profileId, entityIds, startDate, endDate);
    })(),
  ]);

  const actualForFetch = actualByEntity;

  for (const exp of expenses) {
    const expStart = new Date(exp.startDate);
    expStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < expStart) continue;
      const key = dateKey(d);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const actualAmt = getActualAmountForDay(exp.id, "EXPENSE", key, mk, actualForFetch);
      if (actualAmt != null) {
        dailyOutflows[key] = (dailyOutflows[key] ?? 0) + actualAmt;
        hasFactOutflowsByDay[key] = true;
      }
    }
  }

  for (const inc of incomes) {
    const taxPct = Number(inc.taxes ?? 0) / 100;
    const incStart = inc.startDate ? new Date(inc.startDate) : startDate;
    incStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < incStart) continue;
      const key = dateKey(d);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const actualAmt = getActualAmountForDay(inc.id, "INCOME", key, mk, actualForFetch);
      if (actualAmt != null) {
        dailyInflows[key] = (dailyInflows[key] ?? 0) + actualAmt * (1 - taxPct);
        hasFactInflowsByDay[key] = true;
      }
    }
  }

  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (const tx of transactions) {
    if (tx.type !== "IN" && tx.type !== "OUT") continue;
    const txDate = typeof tx.date === "string" ? new Date(tx.date) : tx.date;
    const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    if (txDateOnly < startDateOnly || txDateOnly >= endDateOnly) continue;
    const txKey = toDateKey(tx.date);
    const amount = Number(tx.amount);
    const taxPct = Number(tx.taxes ?? 0) / 100;
    if (tx.type === "IN") {
      dailyInflows[txKey] = (dailyInflows[txKey] ?? 0) + amount * (1 - taxPct);
      hasFactInflowsByDay[txKey] = true;
    } else {
      dailyOutflows[txKey] = (dailyOutflows[txKey] ?? 0) + amount * (1 + taxPct);
      hasFactOutflowsByDay[txKey] = true;
    }
  }

  const dayBeforeStart = new Date(startDate);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  const initialBalance = await computeHistoricalBalance(profileId, dayBeforeStart, { useActualData: true });

  const result: ForecastDayFact[] = [];
  let balance = initialBalance;

  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    const key = dateKey(d);
    const hasFactInflows = hasFactInflowsByDay[key] === true;
    const hasFactOutflows = hasFactOutflowsByDay[key] === true;
    const hasFact = hasFactInflows || hasFactOutflows;
    const inflows = hasFactInflows ? (dailyInflows[key] ?? 0) : null;
    const outflows = hasFactOutflows ? (dailyOutflows[key] ?? 0) : null;

    if (hasFact) {
      const inVal = inflows ?? 0;
      const outVal = outflows ?? 0;
      balance = balance + inVal - outVal;
      result.push({
        date: key,
        balance,
        inflows,
        outflows,
        hasFactData: true,
      });
    } else {
      result.push({
        date: key,
        balance: null,
        inflows: null,
        outflows: null,
        hasFactData: false,
      });
    }
  }

  return result;
}

function getDatesInRange(start: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
}

function getMonthlyOccurrences(
  startDate: Date,
  endDate: Date,
  frequency: "MONTHLY" | "QUARTERLY" | "YEARLY"
): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(startDate);
  const stepMonths = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;

  while (current <= endDate) {
    if (current >= startDate) occurrences.push(new Date(current));
    current.setMonth(current.getMonth() + stepMonths);
  }
  return occurrences;
}

function getIntervalOccurrences(
  startDate: Date,
  endDate: Date,
  intervalDays: number
): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    if (current >= startDate) occurrences.push(new Date(current));
    current.setDate(current.getDate() + intervalDays);
  }
  return occurrences;
}

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
  } = {}
): Promise<ForecastDay[]> {
  const days = options.days ?? 90;
  const useExpectedData = options.useExpectedData ?? false;
  const useActualData = options.useActualData ?? true;
  let initialBalance = options.initialBalance;
  if (initialBalance == null && useExpectedData) {
    const dayBeforeStart = options.startDate
      ? (() => {
          const d = new Date(options.startDate);
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - 1);
          return d;
        })()
      : (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - 1);
          return d;
        })();
    initialBalance = await computeHistoricalBalance(profileId, dayBeforeStart, {
      useActualData,
    });
  }
  initialBalance ??= 0;
  const changes = options.changes ?? {};

  // Regular expenses (регулярные) + manual transactions (разовые) are both included in forecast
  const [expenses, incomes, transactions, monthlyData] = await Promise.all([
    prisma.regularExpense.findMany({
      where: { profileId },
      include: { category: true },
    }),
    prisma.regularIncome.findMany({
      where: { profileId },
    }),
    prisma.manualTransaction.findMany({
      where: { profileId },
    }),
    prisma.profileMonthlyData.findMany({ where: { profileId } }),
  ]);

  const monthlyByMonth = useExpectedData
    ? new Map(monthlyData.map((m) => [m.month, { income: Number(m.income), expense: Number(m.expense) }]))
    : new Map<string, { income: number; expense: number }>();

  const startDate = options.startDate ? (() => {
    const d = new Date(options.startDate!);
    d.setHours(0, 0, 0, 0);
    return d;
  })() : (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const endDate = addDays(startDate, days);

  const dailyInflows: Record<string, number> = {};
  const dailyOutflows: Record<string, number> = {};

  // Batch-fetch ExpectedEntry when useExpectedData (merge with ProfileMonthlyData)
  let expectedByEntity: Map<string, Map<string, number>> | undefined;
  let expectedMonthlyTotal: Map<string, { income: number; expense: number }> | undefined;
  if (useExpectedData) {
    const monthKeys = Array.from(
      new Set(
        Array.from({ length: days }, (_, i) => monthKey(addDays(startDate, i)))
      )
    );
    const entityIds = [
      ...expenses.map((e) => e.id),
      ...incomes.map((i) => i.id),
    ];
    const { byEntity, monthlyTotal } = await fetchExpectedEntriesBatch(
      profileId,
      monthKeys,
      entityIds
    );
    expectedByEntity = byEntity;
    expectedMonthlyTotal = monthlyTotal;
    // Merge ExpectedEntry MONTHLY_TOTAL into monthlyByMonth (overrides ProfileMonthlyData)
    for (const [mk, tot] of expectedMonthlyTotal) {
      if (tot.income > 0 || tot.expense > 0) {
        const existing = monthlyByMonth.get(mk) ?? { income: 0, expense: 0 };
        if (tot.income > 0) existing.income = tot.income;
        if (tot.expense > 0) existing.expense = tot.expense;
        monthlyByMonth.set(mk, existing);
      }
    }
  }

  // Use local date to avoid timezone mismatch between expense occurrences and forecast result
  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  /** Compare dates by calendar day only (ignore time) to avoid timezone/edge-case bugs */
  const dateOnlyCompare = (a: Date, b: Date): number => {
    const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return aDay - bDay;
  };

  const incomeMult = 1 + (changes.incomeGrowthPercent ?? 0) / 100;
  const expenseMult = 1 + (changes.expenseGrowthPercent ?? 0) / 100;

  let actualByEntity: ActualByEntity | null = null;
  if (useActualData) {
    const entityIds = [...expenses.map((e) => e.id), ...incomes.map((i) => i.id)];
    actualByEntity = await fetchActualEntriesBatch(profileId, entityIds, startDate, endDate);
  }

  let expectedFromActual: { dailyInflows: Record<string, number>; dailyOutflows: Record<string, number>; hasEnoughData: boolean } | null = null;
  if (useExpectedData && !useActualData) {
    expectedFromActual = await computeExpectedFromActualPatterns(profileId, { days, startDate });
  }

  if (useExpectedData && monthlyByMonth.size > 0) {
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const mk = monthKey(d);
      const monthly = monthlyByMonth.get(mk);
      if (monthly) {
        const dInMonth = daysInMonth(d);
        const perDayIn = dInMonth > 0 ? (monthly.income / dInMonth) * incomeMult : 0;
        const perDayOut = dInMonth > 0 ? (monthly.expense / dInMonth) * expenseMult : 0;
        const key = dateKey(d);
        if (perDayIn > 0) dailyInflows[key] = (dailyInflows[key] ?? 0) + perDayIn;
        if (perDayOut > 0) dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDayOut;
      }
    }
  }

  if (useExpectedData && expectedFromActual?.hasEnoughData) {
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const mk = monthKey(d);
      if (monthlyByMonth.has(mk)) continue;
      const key = dateKey(d);
      const patIn = expectedFromActual.dailyInflows[key];
      const patOut = expectedFromActual.dailyOutflows[key];
      if (patIn != null && patIn > 0) dailyInflows[key] = (dailyInflows[key] ?? 0) + patIn * incomeMult;
      if (patOut != null && patOut > 0) dailyOutflows[key] = (dailyOutflows[key] ?? 0) + patOut * expenseMult;
    }
  }

  const usePatternForExpected = useExpectedData && expectedFromActual?.hasEnoughData;

  // Per-month cache: compute daily amount once per entity per month (O(months) vs O(days))
  const expensePerDayCache = new Map<string, number>();
  for (const exp of expenses) {
    if (changes.expenseOverrides?.[exp.id]?.hidden) continue;
    const baseAmount = changes.expenseOverrides?.[exp.id]?.amount ?? Number(exp.amount);
    const freq = exp.frequency as string;
    const expectedData = exp.expectedData as Record<string, number> | null | undefined;
    const expStart = exp.startDate;
    const expExpectedByPeriod = expectedByEntity?.get(exp.id);

    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (dateOnlyCompare(d, expStart) < 0) continue;
      const mk = monthKey(d);
      if (monthlyByMonth.has(mk) || usePatternForExpected) continue;
      const key = dateKey(d);
      let perDay: number;
      if (useActualData && actualByEntity) {
        const actualAmt = getActualAmountForDay(exp.id, "EXPENSE", key, mk, actualByEntity);
        if (actualAmt != null) {
          perDay = actualAmt;
        } else {
          const cacheKey = `exp:${exp.id}:${mk}`;
          let cached = expensePerDayCache.get(cacheKey);
          if (cached === undefined) {
            const useAmount = getEffectiveMonthlyAmount(
              exp,
              mk,
              baseAmount,
              expExpectedByPeriod,
              expectedData,
              useExpectedData
            );
            const seasonal = getSeasonalMultiplier(
              exp.seasonalMultiplier as Record<string, number> | null | undefined,
              d
            );
            cached = dailyAmountFromFrequency(freq, useAmount * seasonal, exp.customDays);
            expensePerDayCache.set(cacheKey, cached);
          }
          perDay = cached;
        }
      } else {
        const cacheKey = `exp:${exp.id}:${mk}`;
        let cached = expensePerDayCache.get(cacheKey);
        if (cached === undefined) {
          const useAmount = getEffectiveMonthlyAmount(
            exp,
            mk,
            baseAmount,
            expExpectedByPeriod,
            expectedData,
            useExpectedData
          );
          const seasonal = getSeasonalMultiplier(
            exp.seasonalMultiplier as Record<string, number> | null | undefined,
            d
          );
          cached = dailyAmountFromFrequency(freq, useAmount * seasonal, exp.customDays);
          expensePerDayCache.set(cacheKey, cached);
        }
        perDay = cached;
      }
      if (perDay <= 0) continue;
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDay * expenseMult;
    }
  }

  for (const addExp of changes.addExpenses ?? []) {
    const amount = addExp.amount;
    const freq = addExp.frequency;
    const perDay = dailyAmount(freq, amount, undefined);
    if (perDay <= 0) continue;
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const key = dateKey(d);
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDay * expenseMult;
    }
  }

  for (const inc of incomes) {
    if (changes.incomeOverrides?.[inc.id]?.hidden) continue;
    const grossAmt = changes.incomeOverrides?.[inc.id]?.amount ?? Number(inc.amount ?? inc.avgCheck ?? 0);
    const taxPct = Number(inc.taxes ?? 0) / 100;
    const amt = grossAmt * (1 - taxPct);
    const salesPlan = inc.salesPlan as Record<string, number> | null;
    const expectedData = inc.expectedData as Record<string, number> | null | undefined;
    const hasSalesPlan = !useExpectedData && salesPlan && Object.values(salesPlan).some((v) => v > 0);
    const hasExpectedData = useExpectedData && expectedData && Object.keys(expectedData).length > 0;
    const incStart = inc.startDate ? new Date(inc.startDate) : new Date(startDate);
    incStart.setHours(0, 0, 0, 0);

    const incExpectedByPeriod = expectedByEntity?.get(inc.id);
    const incomePerDayCache = new Map<string, number>();

    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (dateOnlyCompare(d, incStart) < 0) continue;
      const mk = monthKey(d);
      if (monthlyByMonth.has(mk) || usePatternForExpected) continue;
      const key = dateKey(d);

      let daily: number;
      if (useActualData && actualByEntity) {
        const actualAmt = getActualAmountForDay(inc.id, "INCOME", key, mk, actualByEntity);
        if (actualAmt != null) {
          daily = actualAmt * (1 - taxPct);
        } else if (hasExpectedData) {
          const cacheKey = `inc:${inc.id}:${mk}`;
          let cached = incomePerDayCache.get(cacheKey);
          if (cached === undefined) {
            const grossExpected = getEffectiveMonthlyAmount(
              inc,
              mk,
              grossAmt,
              incExpectedByPeriod,
              expectedData,
              true
            );
            cached = getEffectiveDailyAmountForMonth(
              inc,
              d,
              grossExpected,
              true,
              Number(inc.taxes ?? 0)
            );
            incomePerDayCache.set(cacheKey, cached);
          }
          daily = cached;
        } else if (hasSalesPlan) {
          const month = d.getMonth() + 1;
          const grossForMonth = salesPlan![String(month)] ?? grossAmt;
          const netForMonth = grossForMonth * (1 - taxPct);
          const dInMonth = daysInMonth(d);
          daily = dInMonth > 0 ? netForMonth / dInMonth : 0;
        } else if (amt > 0) {
          const freq = inc.frequency as string;
          daily = dailyAmountFromFrequency(freq, amt, inc.customDays);
        } else {
          daily = 0;
        }
      } else {
        if (hasExpectedData) {
          const cacheKey = `inc:${inc.id}:${mk}`;
          let cached = incomePerDayCache.get(cacheKey);
          if (cached === undefined) {
            const grossExpected = getEffectiveMonthlyAmount(
              inc,
              mk,
              grossAmt,
              incExpectedByPeriod,
              expectedData,
              true
            );
            cached = getEffectiveDailyAmountForMonth(
              inc,
              d,
              grossExpected,
              true,
              Number(inc.taxes ?? 0)
            );
            incomePerDayCache.set(cacheKey, cached);
          }
          daily = cached;
        } else if (hasSalesPlan) {
          const month = d.getMonth() + 1;
          const grossForMonth = salesPlan![String(month)] ?? grossAmt;
          const netForMonth = grossForMonth * (1 - taxPct);
          const dInMonth = daysInMonth(d);
          daily = dInMonth > 0 ? netForMonth / dInMonth : 0;
        } else if (amt > 0) {
          const freq = inc.frequency as string;
          daily = dailyAmountFromFrequency(freq, amt, inc.customDays);
        } else {
          daily = 0;
        }
      }

      if (daily > 0) {
        dailyInflows[key] = (dailyInflows[key] ?? 0) + daily * incomeMult;
      }
    }
  }

  for (const addInc of changes.addIncomes ?? []) {
    const amt = addInc.amount;
    const freq = addInc.frequency;
    const perDay = dailyAmount(freq, amt, undefined);
    if (perDay <= 0) continue;
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      const key = dateKey(d);
      dailyInflows[key] = (dailyInflows[key] ?? 0) + perDay * incomeMult;
    }
  }

  // Разовые операции (manual transactions) — ТОЛЬКО на конкретную дату, полная сумма один раз.
  // Не распределяем по дням — каждая разовая операция учитывается строго в свой день.
  const forecastKeys = new Set<string>();
  for (let i = 0; i < days; i++) {
    forecastKeys.add(dateKey(addDays(startDate, i)));
  }
  const toDateKey = (d: Date | string): string => {
    if (typeof d === "string") return d.slice(0, 10);
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (const tx of transactions) {
    if (tx.type !== "IN" && tx.type !== "OUT") continue;
    if (changes.manualOverrides?.[tx.id]?.hidden) continue;
    const txDate = typeof tx.date === "string" ? new Date(tx.date) : tx.date;
    const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
    if (txDateOnly < startDateOnly || txDateOnly >= endDateOnly) continue;
    const txKey = toDateKey(tx.date);
    if (!forecastKeys.has(txKey)) continue;
    const amount = changes.manualOverrides?.[tx.id]?.amount ?? Number(tx.amount);
    const taxPct = Number(tx.taxes ?? 0) / 100;
    if (tx.type === "IN") {
      const netAmount = amount * (1 - taxPct) * incomeMult;
      dailyInflows[txKey] = (dailyInflows[txKey] ?? 0) + netAmount;
    } else {
      const totalAmount = amount * (1 + taxPct) * expenseMult;
      dailyOutflows[txKey] = (dailyOutflows[txKey] ?? 0) + totalAmount;
    }
  }

  for (const addTx of changes.addManual ?? []) {
    const key = addTx.date.slice(0, 10);
    if (!forecastKeys.has(key)) continue;
    const addTxDate = new Date(addTx.date);
    const addTxDateOnly = new Date(addTxDate.getFullYear(), addTxDate.getMonth(), addTxDate.getDate());
    if (addTxDateOnly < startDateOnly || addTxDateOnly >= endDateOnly) continue;
    const amount = addTx.amount;
    if (addTx.type === "IN") {
      dailyInflows[key] = (dailyInflows[key] ?? 0) + amount * incomeMult;
    } else {
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + amount * expenseMult;
    }
  }

  const result: ForecastDay[] = [];
  let balance = initialBalance;

  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    const key = dateKey(d);
    const inflows = dailyInflows[key] ?? 0;
    const outflows = dailyOutflows[key] ?? 0;
    balance = balance + inflows - outflows;
    result.push({
      date: key,
      balance,
      inflows,
      outflows,
    });
  }

  return result;
}

export function getRedZones(
  forecast: ForecastDay[],
  zoneRedMax = -50000
): ForecastDay[] {
  return forecast.filter((d) => d.balance < zoneRedMax);
}

/** Debug: returns raw data for browser console logging */
export async function computeForecastDebug(
  profileId: string,
  options: { days?: number } = {}
) {
  const days = options.days ?? 30;
  const [expenses, incomes, transactions] = await Promise.all([
    prisma.regularExpense.findMany({
      where: { profileId },
      include: { category: true },
    }),
    prisma.regularIncome.findMany({ where: { profileId } }),
    prisma.manualTransaction.findMany({ where: { profileId } }),
  ]);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = addDays(startDate, days);

  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const dailyOutflows: Record<string, number> = {};
  const dailyAmount = (freq: string, amount: number, customDays?: number | null) => {
    switch (freq) {
      case "DAILY": return amount;
      case "WEEKLY": return amount / 7;
      case "MONTHLY": return amount / 30;
      case "QUARTERLY": return amount / 90;
      case "YEARLY": return amount / 365;
      case "CUSTOM": return customDays && customDays > 0 ? amount / customDays : 0;
      default: return amount / 30;
    }
  };
  const expenseOccurrences: { name: string; amount: number; freq: string; perDay: number }[] = [];

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    const freq = exp.frequency as string;
    const perDay = dailyAmount(freq, amount, exp.customDays);
    expenseOccurrences.push({ name: exp.name, amount, freq, perDay });
    if (perDay <= 0) continue;
    const expStart = exp.startDate;
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < expStart) continue;
      const key = dateKey(d);
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDay;
    }
  }

  for (const tx of transactions) {
    if (tx.type !== "OUT") continue;
    const key = dateKey(tx.date);
    const amount = Number(tx.amount);
    const taxPct = Number(tx.taxes ?? 0) / 100;
    dailyOutflows[key] = (dailyOutflows[key] ?? 0) + amount * (1 + taxPct);
  }

  const resultKeys = Array.from({ length: Math.min(7, days) }, (_, i) => dateKey(addDays(startDate, i)));

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    regularExpenses: {
      count: expenses.length,
      list: expenses.map((e) => ({ name: e.name, amount: Number(e.amount), frequency: e.frequency, startDate: e.startDate.toISOString() })),
      occurrences: expenseOccurrences,
    },
    manualTransactions: {
      count: transactions.filter((t) => t.type === "OUT").length,
      list: transactions.filter((t) => t.type === "OUT").map((t) => ({ date: t.date.toISOString(), amount: Number(t.amount) })),
    },
    dailyOutflowsSample: resultKeys.reduce((acc, k) => ({ ...acc, [k]: dailyOutflows[k] ?? 0 }), {} as Record<string, number>),
    resultKeysFirst7: resultKeys,
  };
}
