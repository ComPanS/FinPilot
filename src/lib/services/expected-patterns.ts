/**
 * ExpectedPatterns — build daily pattern factors from ActualEntry, ManualTransaction, ProfileMonthlyData.
 *
 * Learns weekday, month-day, and month factors from historical data.
 * Factors are applied as multipliers to baseDaily for adaptive forecast.
 */

import { prisma } from "@/lib/prisma";
import {
  fetchActualEntriesBatch,
  getActualAmountForDay,
} from "./actual-data";
import { daysInMonth, monthKey } from "./expected-data";

const MIN_DAYS_WITH_DATA = 30;

/**
 * Apply pattern-based scaling to monthly totals.
 * Instead of uniform distribution (target/daysInMonth), uses pattern factors
 * so the curve follows weekday/monthDay/month patterns while summing to target.
 *
 * @param patternMap - factors per dateKey; if null/empty, falls back to uniform
 * @param monthlyByMonth - target income/expense per month (YYYY-MM)
 * @param dateKeyFn - (d) => "YYYY-MM-DD"
 * @param addDaysFn - (d, n) => Date
 * @param monthKeyFn - (d) => "YYYY-MM"
 * @param startDate - forecast start
 * @param days - forecast length
 */
export function applyMonthlyScaling(
  patternMap: Map<string, PatternMapEntry> | null,
  monthlyByMonth: Map<string, { income: number; expense: number }>,
  dateKeyFn: (d: Date) => string,
  addDaysFn: (d: Date, n: number) => Date,
  monthKeyFn: (d: Date) => string,
  startDate: Date,
  days: number,
  incomeMult: number,
  expenseMult: number,
): { inflows: Record<string, number>; outflows: Record<string, number> } {
  const inflows: Record<string, number> = {};
  const outflows: Record<string, number> = {};
  const hasPatterns = patternMap != null && patternMap.size > 0;

  const monthsInRange = new Set(
    Array.from({ length: days }, (_, i) =>
      monthKeyFn(addDaysFn(startDate, i)),
    ),
  );

  for (const mk of monthsInRange) {
    const monthly = monthlyByMonth.get(mk);
    if (!monthly || (monthly.income <= 0 && monthly.expense <= 0)) continue;

    const targetIn = monthly.income > 0 ? monthly.income * incomeMult : 0;
    const targetOut = monthly.expense > 0 ? monthly.expense * expenseMult : 0;
    if (targetIn <= 0 && targetOut <= 0) continue;

    const daysInThisMonth: { key: string; shapeIn: number; shapeOut: number }[] =
      [];
    let patternSumIn = 0;
    let patternSumOut = 0;

    for (let i = 0; i < days; i++) {
      const d = addDaysFn(startDate, i);
      if (monthKeyFn(d) !== mk) continue;
      const key = dateKeyFn(d);

      let shapeIn = 1;
      let shapeOut = 1;
      if (hasPatterns) {
        const entry = patternMap!.get(key);
        if (entry) {
          shapeIn =
            entry.inflow.weekdayFactor *
            entry.inflow.monthDayFactor *
            entry.inflow.monthFactor;
          shapeOut =
            entry.outflow.weekdayFactor *
            entry.outflow.monthDayFactor *
            entry.outflow.monthFactor;
        }
      }
      daysInThisMonth.push({ key, shapeIn, shapeOut });
      patternSumIn += shapeIn;
      patternSumOut += shapeOut;
    }

    const scaleIn =
      targetIn > 0 && patternSumIn > 0 ? targetIn / patternSumIn : 0;
    const scaleOut =
      targetOut > 0 && patternSumOut > 0 ? targetOut / patternSumOut : 0;

    for (const { key, shapeIn, shapeOut } of daysInThisMonth) {
      if (scaleIn > 0) {
        inflows[key] = (inflows[key] ?? 0) + shapeIn * scaleIn;
      }
      if (scaleOut > 0) {
        outflows[key] = (outflows[key] ?? 0) + shapeOut * scaleOut;
      }
    }
  }

  return { inflows, outflows };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PatternFactors = {
  weekdayFactor: number;
  monthDayFactor: number;
  monthFactor: number;
};

export type PatternMapEntry = {
  inflow: PatternFactors;
  outflow: PatternFactors;
};

/**
 * Build daily inflows/outflows from ActualEntry + ManualTransaction + ProfileMonthlyData.
 */
async function buildHistoricalDailyFlows(
  profileId: string,
  entityIds: string[],
  expenseIds: string[],
  incomeIds: string[],
  incomeTaxRates: Map<string, number>,
  startDate: Date,
  endDate: Date,
  monthlyByMonth: Map<string, { income: number; expense: number }>
): Promise<{
  inflows: Record<string, number>;
  outflows: Record<string, number>;
  daysWithData: Set<string>;
}> {
  const actualByEntity = await fetchActualEntriesBatch(
    profileId,
    entityIds,
    startDate,
    endDate
  );

  const transactions = await prisma.manualTransaction.findMany({
    where: { profileId },
  });

  const inflows: Record<string, number> = {};
  const outflows: Record<string, number> = {};
  const daysWithData = new Set<string>();

  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(startDate, i);
    const key = dateKey(d);
    if (key > endKey) break;

    let dayIn = 0;
    let dayOut = 0;

    const mk = monthKey(d);
    const monthly = monthlyByMonth.get(mk);
    if (monthly) {
      const dInMonth = daysInMonth(d);
      if (dInMonth > 0) {
        dayIn += monthly.income / dInMonth;
        dayOut += monthly.expense / dInMonth;
        daysWithData.add(key);
      }
    }

    for (const eid of expenseIds) {
      const amt = getActualAmountForDay(
        eid,
        "EXPENSE",
        key,
        mk,
        actualByEntity
      );
      if (amt != null) {
        dayOut += amt;
        daysWithData.add(key);
      }
    }

    for (const iid of incomeIds) {
      const amt = getActualAmountForDay(iid, "INCOME", key, mk, actualByEntity);
      if (amt != null) {
        const taxPct = incomeTaxRates.get(iid) ?? 0;
        dayIn += amt * (1 - taxPct / 100);
        daysWithData.add(key);
      }
    }

    const startDateOnly = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const endDateOnly = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    for (const tx of transactions) {
      if (tx.type !== "IN" && tx.type !== "OUT") continue;
      const txDate =
        typeof tx.date === "string" ? new Date(tx.date) : tx.date;
      const txDateOnly = new Date(
        txDate.getFullYear(),
        txDate.getMonth(),
        txDate.getDate()
      );
      if (txDateOnly < startDateOnly || txDateOnly > endDateOnly) continue;
      const txKey = dateKey(txDate);
      if (txKey !== key) continue;

      const amount = Number(tx.amount);
      const taxPct = Number(tx.taxes ?? 0) / 100;
      if (tx.type === "IN") {
        dayIn += amount * (1 - taxPct);
        daysWithData.add(key);
      } else {
        dayOut += amount * (1 + taxPct);
        daysWithData.add(key);
      }
    }

    if (dayIn > 0) inflows[key] = (inflows[key] ?? 0) + dayIn;
    if (dayOut > 0) outflows[key] = (outflows[key] ?? 0) + dayOut;
  }

  return { inflows, outflows, daysWithData };
}

/**
 * Build pattern factors (weekday, monthDay, month) from historical deviations.
 * Normalizes so each factor type averages to 1.0.
 */
function buildFactorsFromDeviations(
  deviations: { key: string; value: number }[]
): {
  weekdayFactor: Record<number, number>;
  monthDayFactor: Record<number, number>;
  monthFactor: Record<string, number>;
} {
  const byDow: Record<number, number[]> = {};
  const byDom: Record<number, number[]> = {};
  const byMonth: Record<string, number[]> = {};
  for (let i = 0; i < 7; i++) byDow[i] = [];
  for (let i = 1; i <= 31; i++) byDom[i] = [];
  for (let m = 1; m <= 12; m++) {
    byMonth[String(m).padStart(2, "0")] = [];
  }

  for (const { key, value } of deviations) {
    if (value <= 0) continue;
    const [y, m, day] = key.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 1, day ?? 1);
    const dow = d.getDay();
    const dom = d.getDate();
    const monthStr = String(m ?? 1).padStart(2, "0");
    byDow[dow].push(value);
    byDom[dom].push(value);
    byMonth[monthStr].push(value);
  }

  const normalize = (arr: number[]): number =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 1;

  const weekdayFactor: Record<number, number> = {};
  const monthDayFactor: Record<number, number> = {};
  const monthFactor: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    weekdayFactor[i] = normalize(byDow[i]);
  }
  for (let i = 1; i <= 31; i++) {
    monthDayFactor[i] = normalize(byDom[i]);
  }
  for (let m = 1; m <= 12; m++) {
    const ms = String(m).padStart(2, "0");
    monthFactor[ms] = normalize(byMonth[ms]);
  }

  const meanWeekday =
    Object.values(weekdayFactor).reduce((a, b) => a + b, 0) / 7;
  const meanMonthDay =
    Object.values(monthDayFactor).reduce((a, b) => a + b, 0) / 31;
  const meanMonth =
    Object.values(monthFactor).reduce((a, b) => a + b, 0) / 12;

  for (let i = 0; i < 7; i++) {
    weekdayFactor[i] = meanWeekday > 0 ? weekdayFactor[i] / meanWeekday : 1;
  }
  for (let i = 1; i <= 31; i++) {
    monthDayFactor[i] = meanMonthDay > 0 ? monthDayFactor[i] / meanMonthDay : 1;
  }
  for (let m = 1; m <= 12; m++) {
    const ms = String(m).padStart(2, "0");
    monthFactor[ms] = meanMonth > 0 ? monthFactor[ms] / meanMonth : 1;
  }

  return { weekdayFactor, monthDayFactor, monthFactor };
}

/**
 * Build daily pattern map for forecast range.
 * Returns factors per dateKey for inflow and outflow separately.
 */
export async function buildDailyPatternMap(
  profileId: string,
  startDate: Date,
  days: number,
  options?: { patternLookbackMonths?: number }
): Promise<{
  patternMap: Map<string, PatternMapEntry>;
  hasEnoughData: boolean;
  daysWithData: number;
}> {
  const lookbackMonths = options?.patternLookbackMonths ?? 12;
  const lookbackDays = Math.min(365, lookbackMonths * 30);

  const start = (() => {
    const d = new Date(startDate);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  lookbackStart.setHours(0, 0, 0, 0);

  const endDate = addDays(start, -1);

  const [expenses, incomes, monthlyData] = await Promise.all([
    prisma.regularExpense.findMany({ where: { profileId } }),
    prisma.regularIncome.findMany({ where: { profileId } }),
    prisma.profileMonthlyData.findMany({ where: { profileId } }),
  ]);

  const expenseIds = expenses.map((e) => e.id);
  const incomeIds = incomes.map((i) => i.id);
  const entityIds = [...expenseIds, ...incomeIds];
  const incomeTaxRates = new Map(incomes.map((i) => [i.id, Number(i.taxes ?? 0)]));

  const monthlyByMonth = new Map(
    monthlyData.map((m) => [
      m.month,
      { income: Number(m.income), expense: Number(m.expense) },
    ])
  );

  const { inflows: histIn, outflows: histOut, daysWithData } =
    await buildHistoricalDailyFlows(
      profileId,
      entityIds,
      expenseIds,
      incomeIds,
      incomeTaxRates,
      lookbackStart,
      endDate,
      monthlyByMonth
    );

  if (daysWithData.size < MIN_DAYS_WITH_DATA) {
    return {
      patternMap: new Map(),
      hasEnoughData: false,
      daysWithData: daysWithData.size,
    };
  }

  const totalIn = Object.values(histIn).reduce((a, b) => a + b, 0);
  const totalOut = Object.values(histOut).reduce((a, b) => a + b, 0);
  const cnt = Math.max(1, daysWithData.size);
  const avgDailyIn = totalIn / cnt;
  const avgDailyOut = totalOut / cnt;

  const deviationsIn: { key: string; value: number }[] = [];
  const deviationsOut: { key: string; value: number }[] = [];

  const allKeys = new Set([...Object.keys(histIn), ...Object.keys(histOut)]);
  for (const key of allKeys) {
    const amtIn = histIn[key] ?? 0;
    const amtOut = histOut[key] ?? 0;
    if (amtIn > 0 && avgDailyIn > 0) {
      deviationsIn.push({ key, value: amtIn / avgDailyIn });
    }
    if (amtOut > 0 && avgDailyOut > 0) {
      deviationsOut.push({ key, value: amtOut / avgDailyOut });
    }
  }

  const factorsIn = buildFactorsFromDeviations(deviationsIn);
  const factorsOut = buildFactorsFromDeviations(deviationsOut);

  const patternMap = new Map<string, PatternMapEntry>();

  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const key = dateKey(d);
    const dow = d.getDay();
    const dom = d.getDate();
    const monthStr = String(d.getMonth() + 1).padStart(2, "0");

    patternMap.set(key, {
      inflow: {
        weekdayFactor: factorsIn.weekdayFactor[dow] ?? 1,
        monthDayFactor: factorsIn.monthDayFactor[dom] ?? 1,
        monthFactor: factorsIn.monthFactor[monthStr] ?? 1,
      },
      outflow: {
        weekdayFactor: factorsOut.weekdayFactor[dow] ?? 1,
        monthDayFactor: factorsOut.monthDayFactor[dom] ?? 1,
        monthFactor: factorsOut.monthFactor[monthStr] ?? 1,
      },
    });
  }

  return {
    patternMap,
    hasEnoughData: true,
    daysWithData: daysWithData.size,
  };
}
