import { prisma } from "@/lib/prisma";
import type { ForecastDay, WhatIfChanges } from "@/types";

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
    initialBalance?: number;
    changes?: WhatIfChanges;
    zoneGreenMin?: number;
    zoneRedMax?: number;
    useExpectedData?: boolean;
  } = {}
): Promise<ForecastDay[]> {
  const days = options.days ?? 90;
  const useExpectedData = options.useExpectedData ?? false;
  const initialBalance = options.initialBalance ?? 0;
  const changes = options.changes ?? {};

  // Regular expenses (регулярные) + manual transactions (разовые) are both included in forecast
  const [expenses, incomes, transactions] = await Promise.all([
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
  ]);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = addDays(startDate, days);

  const dailyInflows: Record<string, number> = {};
  const dailyOutflows: Record<string, number> = {};

  // Use local date to avoid timezone mismatch between expense occurrences and forecast result
  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Равномерное распределение регулярных расходов по частоте (в день)
  function dailyAmount(freq: string, amount: number, customDays?: number | null): number {
    switch (freq) {
      case "DAILY":
        return amount;
      case "WEEKLY":
        return amount / 7;
      case "MONTHLY":
        return amount / 30;
      case "QUARTERLY":
        return amount / 90;
      case "YEARLY":
        return amount / 365;
      case "CUSTOM":
        return customDays && customDays > 0 ? amount / customDays : 0;
      default:
        return amount / 30;
    }
  }

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (const exp of expenses) {
    let amount = Number(exp.amount);
    if (changes.purchaseIncreasePercent && exp.category.slug === "purchases") {
      amount *= 1 + (changes.purchaseIncreasePercent ?? 0) / 100;
    }
    if (changes.newEmployee && exp.category.slug === "salary") {
      const empStart = new Date(changes.newEmployee.startDate);
      if (empStart <= endDate) {
        amount += changes.newEmployee.amount;
      }
    }
    const freq = exp.frequency as string;
    const expectedData = exp.expectedData as Record<string, number> | null | undefined;
    const expStart = exp.startDate;

    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i);
      if (d < expStart) continue;
      let useAmount = amount;
      if (useExpectedData && expectedData) {
        const mk = monthKey(d);
        const expected = expectedData[mk];
        if (expected != null && !Number.isNaN(expected)) {
          useAmount = expected;
        }
      }
      const perDay = dailyAmount(freq, useAmount, exp.customDays);
      if (perDay <= 0) continue;
      const key = dateKey(d);
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + perDay;
    }
  }

  for (const inc of incomes) {
    const amt = Number(inc.amount ?? inc.avgCheck ?? 0);
    const salesPlan = inc.salesPlan as Record<string, number> | null;
    const expectedData = inc.expectedData as Record<string, number> | null | undefined;
    const hasSalesPlan = !useExpectedData && salesPlan && Object.values(salesPlan).some((v) => v > 0);
    const hasExpectedData = useExpectedData && expectedData && Object.keys(expectedData).length > 0;

    if (hasExpectedData) {
      for (let i = 0; i < days; i++) {
        const d = addDays(startDate, i);
        const mk = monthKey(d);
        const expected = expectedData[mk];
        const amount = (expected != null && !Number.isNaN(expected) ? expected : amt) / 30;
        if (amount > 0) {
          const key = dateKey(d);
          dailyInflows[key] = (dailyInflows[key] ?? 0) + amount;
        }
      }
    } else if (hasSalesPlan) {
      const start = new Date(startDate);
      for (let i = 0; i < days; i++) {
        const d = addDays(start, i);
        const month = d.getMonth() + 1;
        const amount = (salesPlan![String(month)] ?? amt) / 30;
        if (changes.paymentDelayDays && amount > 0) {
          const delayedDate = addDays(d, changes.paymentDelayDays);
          const key = dateKey(delayedDate);
          dailyInflows[key] = (dailyInflows[key] ?? 0) + amount;
        } else {
          const key = dateKey(d);
          dailyInflows[key] = (dailyInflows[key] ?? 0) + amount;
        }
      }
    } else if (amt > 0) {
      const incStart = inc.startDate ? new Date(inc.startDate) : new Date();
      incStart.setHours(0, 0, 0, 0);
      const freq = inc.frequency as string;
      const perDay = dailyAmount(freq, amt, inc.customDays);
      if (perDay <= 0) continue;
      for (let i = 0; i < days; i++) {
        const d = addDays(startDate, i);
        if (d < incStart) continue;
        const key = dateKey(d);
        dailyInflows[key] = (dailyInflows[key] ?? 0) + perDay;
      }
    }
  }

  for (const tx of transactions) {
    const key = dateKey(tx.date);
    if (tx.type === "IN") {
      dailyInflows[key] = (dailyInflows[key] ?? 0) + Number(tx.amount);
    } else {
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + Number(tx.amount);
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
    dailyOutflows[key] = (dailyOutflows[key] ?? 0) + Number(tx.amount);
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
