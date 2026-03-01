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

export async function computeForecast(
  profileId: string,
  options: {
    days?: number;
    initialBalance?: number;
    changes?: WhatIfChanges;
    zoneGreenMin?: number;
    zoneRedMax?: number;
  } = {}
): Promise<ForecastDay[]> {
  const days = options.days ?? 90;
  const initialBalance = options.initialBalance ?? 0;
  const changes = options.changes ?? {};

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

  const dateKey = (d: Date) => d.toISOString().slice(0, 10);

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
    const occs = getMonthlyOccurrences(
      exp.startDate,
      endDate,
      exp.frequency as "MONTHLY" | "QUARTERLY" | "YEARLY"
    );
    for (const d of occs) {
      const key = dateKey(d);
      dailyOutflows[key] = (dailyOutflows[key] ?? 0) + amount;
    }
  }

  for (const inc of incomes) {
    const salesPlan = inc.salesPlan as Record<string, number>;
    const start = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      const month = d.getMonth() + 1;
      const amount = (salesPlan[String(month)] ?? Number(inc.avgCheck)) / 30;
      if (changes.paymentDelayDays && amount > 0) {
        const delayedDate = addDays(d, changes.paymentDelayDays);
        const key = dateKey(delayedDate);
        dailyInflows[key] = (dailyInflows[key] ?? 0) + amount;
      } else {
        const key = dateKey(d);
        dailyInflows[key] = (dailyInflows[key] ?? 0) + amount;
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
