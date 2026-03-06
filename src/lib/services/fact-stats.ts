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
      let current = new Date(start);
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
