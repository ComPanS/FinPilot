/**
 * ExpectedFromActual — compute expected daily flows from ActualEntry patterns.
 *
 * Uses day-of-week (0–6) and day-of-month (1–31) averages from historical actual data.
 * For future days: applies pattern or fallback to base amount × frequency.
 * No goal of "catching up" to target profit — only pattern extrapolation.
 */

import { prisma } from "@/lib/prisma";
import { fetchActualEntriesBatch, getActualAmountForDay } from "./actual-data";

const MIN_DAYS_WITH_DATA = 7;
const LOOKBACK_MONTHS = 6;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export type ExpectedFromActualResult = {
  dailyInflows: Record<string, number>;
  dailyOutflows: Record<string, number>;
  hasEnoughData: boolean;
};

/**
 * Build daily inflows/outflows from ActualEntry for a date range.
 * Expands monthly amounts by day, uses exact amounts for daily/range periods.
 */
async function buildDailyFlowsFromActual(
  profileId: string,
  entityIds: string[],
  expenseIds: string[],
  incomeIds: string[],
  startDate: Date,
  endDate: Date,
  incomeTaxRates: Map<string, number>
): Promise<{ inflows: Record<string, number>; outflows: Record<string, number>; daysWithData: Set<string> }> {
  const actualByEntity = await fetchActualEntriesBatch(
    profileId,
    entityIds,
    startDate,
    endDate
  );

  const inflows: Record<string, number> = {};
  const outflows: Record<string, number> = {};
  const daysWithData = new Set<string>();

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);

  for (let i = 0; i <= Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)); i++) {
    const d = addDays(startDate, i);
    const key = dateKey(d);
    if (key > endKey) break;

    let dayIn = 0;
    let dayOut = 0;

    for (const eid of expenseIds) {
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amt = getActualAmountForDay(eid, "EXPENSE", key, mk, actualByEntity);
      if (amt != null) {
        dayOut += amt;
        daysWithData.add(key);
      }
    }

    for (const iid of incomeIds) {
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amt = getActualAmountForDay(iid, "INCOME", key, mk, actualByEntity);
      if (amt != null) {
        const taxPct = incomeTaxRates.get(iid) ?? 0;
        dayIn += amt * (1 - taxPct / 100);
        daysWithData.add(key);
      }
    }

    if (dayIn > 0) inflows[key] = (inflows[key] ?? 0) + dayIn;
    if (dayOut > 0) outflows[key] = (outflows[key] ?? 0) + dayOut;
  }

  return { inflows, outflows, daysWithData };
}

/**
 * Compute expected daily flows from ActualEntry patterns.
 * Returns daily inflows/outflows for [startDate, startDate+days).
 */
export async function computeExpectedFromActualPatterns(
  profileId: string,
  options: {
    days?: number;
    startDate?: Date;
  } = {}
): Promise<ExpectedFromActualResult> {
  const days = options.days ?? 90;
  const startDate = options.startDate
    ? (() => {
        const d = new Date(options.startDate);
        d.setHours(0, 0, 0, 0);
        return d;
      })()
    : (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

  const [expenses, incomes] = await Promise.all([
    prisma.regularExpense.findMany({ where: { profileId } }),
    prisma.regularIncome.findMany({ where: { profileId } }),
  ]);

  const expenseIds = expenses.map((e) => e.id);
  const incomeIds = incomes.map((i) => i.id);
  const entityIds = [...expenseIds, ...incomeIds];
  const incomeTaxRates = new Map(incomes.map((i) => [i.id, Number(i.taxes ?? 0)]));

  const lookbackStart = new Date(startDate);
  lookbackStart.setMonth(lookbackStart.getMonth() - LOOKBACK_MONTHS);
  lookbackStart.setHours(0, 0, 0, 0);

  const { inflows: histIn, outflows: histOut, daysWithData } = await buildDailyFlowsFromActual(
    profileId,
    entityIds,
    expenseIds,
    incomeIds,
    lookbackStart,
    addDays(startDate, -1),
    incomeTaxRates
  );

  if (daysWithData.size < MIN_DAYS_WITH_DATA) {
    return {
      dailyInflows: {},
      dailyOutflows: {},
      hasEnoughData: false,
    };
  }

  const byDayOfWeek: Record<number, { in: number[]; out: number[] }> = {};
  const byDayOfMonth: Record<number, { in: number[]; out: number[] }> = {};
  for (let i = 0; i < 7; i++) byDayOfWeek[i] = { in: [], out: [] };
  for (let i = 1; i <= 31; i++) byDayOfMonth[i] = { in: [], out: [] };

  const allKeys = new Set([...Object.keys(histIn), ...Object.keys(histOut)]);
  for (const key of allKeys) {
    const [y, m, day] = key.split("-").map(Number);
    const d = new Date(y, (m ?? 1) - 1, day ?? 1);
    const dow = d.getDay();
    const dom = d.getDate();
    const amtIn = histIn[key] ?? 0;
    const amtOut = histOut[key] ?? 0;
    if (amtIn === 0 && amtOut === 0) continue;
    if (amtIn > 0) {
      byDayOfWeek[dow].in.push(amtIn);
      byDayOfMonth[dom].in.push(amtIn);
    }
    if (amtOut > 0) {
      byDayOfWeek[dow].out.push(amtOut);
      byDayOfMonth[dom].out.push(amtOut);
    }
  }

  const avgByDow = (dow: number) => ({
    in: byDayOfWeek[dow].in.length > 0
      ? byDayOfWeek[dow].in.reduce((a, b) => a + b, 0) / byDayOfWeek[dow].in.length
      : 0,
    out: byDayOfWeek[dow].out.length > 0
      ? byDayOfWeek[dow].out.reduce((a, b) => a + b, 0) / byDayOfWeek[dow].out.length
      : 0,
  });
  const avgByDom = (dom: number) => ({
    in: byDayOfMonth[dom].in.length > 0
      ? byDayOfMonth[dom].in.reduce((a, b) => a + b, 0) / byDayOfMonth[dom].in.length
      : 0,
    out: byDayOfMonth[dom].out.length > 0
      ? byDayOfMonth[dom].out.reduce((a, b) => a + b, 0) / byDayOfMonth[dom].out.length
      : 0,
  });

  const totalIn = Object.values(histIn).reduce((a, b) => a + b, 0);
  const totalOut = Object.values(histOut).reduce((a, b) => a + b, 0);
  const cnt = Math.max(1, daysWithData.size);
  const overallAvgIn = totalIn / cnt;
  const overallAvgOut = totalOut / cnt;

  const dailyInflows: Record<string, number> = {};
  const dailyOutflows: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    const key =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dow = d.getDay();
    const dom = d.getDate();

    const dowAvg = avgByDow(dow);
    const domAvg = avgByDom(dom);

    let inVal = 0;
    let outVal = 0;
    if (dowAvg.in > 0 || dowAvg.out > 0) {
      inVal = dowAvg.in;
      outVal = dowAvg.out;
    } else if (domAvg.in > 0 || domAvg.out > 0) {
      inVal = domAvg.in;
      outVal = domAvg.out;
    } else {
      inVal = overallAvgIn;
      outVal = overallAvgOut;
    }

    if (inVal > 0) dailyInflows[key] = Math.round(inVal * 100) / 100;
    if (outVal > 0) dailyOutflows[key] = Math.round(outVal * 100) / 100;
  }

  return {
    dailyInflows,
    dailyOutflows,
    hasEnoughData: true,
  };
}
