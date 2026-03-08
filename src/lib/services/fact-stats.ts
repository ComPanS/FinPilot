/**
 * Fact stats — count unique days with fact data (ActualEntry + ManualTransaction).
 */

import { prisma } from "@/lib/prisma";

function periodToDateKeys(period: string): Set<string> {
  const keys = new Set<string>();
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const daysInMonth = new Date(y!, m!, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      keys.add(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    keys.add(period);
  } else {
    const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const start = new Date(m[1]! + "T12:00:00");
      const end = new Date(m[2]! + "T12:00:00");
      const current = new Date(start);
      while (current <= end) {
        keys.add(
          `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`,
        );
        current.setDate(current.getDate() + 1);
      }
    }
  }
  return keys;
}

/**
 * Count unique days covered by ActualEntry and ManualTransaction for a profile.
 */
export async function countDaysWithFactData(profileId: string): Promise<number> {
  const [actualEntries, manualTransactions] = await Promise.all([
    prisma.actualEntry.findMany({
      where: { profileId },
      select: { period: true },
    }),
    prisma.manualTransaction.findMany({
      where: { profileId },
      select: { date: true },
    }),
  ]);

  const allKeys = new Set<string>();

  for (const e of actualEntries) {
    for (const k of periodToDateKeys(e.period)) {
      allKeys.add(k);
    }
  }

  for (const t of manualTransactions) {
    const d = typeof t.date === "string" ? new Date(t.date) : t.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    allKeys.add(key);
  }

  return allKeys.size;
}

/**
 * Get set of months (YYYY-MM) that have at least one day of fact data.
 */
export async function getMonthsWithFactData(profileId: string): Promise<Set<string>> {
  const [actualEntries, manualTransactions] = await Promise.all([
    prisma.actualEntry.findMany({
      where: { profileId },
      select: { period: true },
    }),
    prisma.manualTransaction.findMany({
      where: { profileId },
      select: { date: true },
    }),
  ]);

  const allKeys = new Set<string>();

  for (const e of actualEntries) {
    for (const k of periodToDateKeys(e.period)) {
      allKeys.add(k);
    }
  }

  for (const t of manualTransactions) {
    const d = typeof t.date === "string" ? new Date(t.date) : t.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    allKeys.add(key);
  }

  const months = new Set<string>();
  for (const k of allKeys) {
    months.add(k.substring(0, 7)); // YYYY-MM
  }
  return months;
}

/**
 * Check if both current month and previous month have at least one day of fact data.
 */
export async function hasLast2MonthsFactData(profileId: string): Promise<boolean> {
  const months = await getMonthsWithFactData(profileId);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  return months.has(currentMonth) && months.has(prevMonth);
}

/**
 * Check if current month and two previous months have at least one day of fact data.
 */
export async function hasLast3MonthsFactData(profileId: string): Promise<boolean> {
  const months = await getMonthsWithFactData(profileId);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevMonth1 = `${prev1.getFullYear()}-${String(prev1.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth2 = `${prev2.getFullYear()}-${String(prev2.getMonth() + 1).padStart(2, "0")}`;
  return months.has(currentMonth) && months.has(prevMonth1) && months.has(prevMonth2);
}
