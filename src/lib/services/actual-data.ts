/**
 * ActualDataService — resolution of actual amounts for forecast.
 *
 * Priority: actualData > ProfileMonthlyData > expectedData > base amount
 *
 * Period formats:
 * - YYYY-MM: amount for full month, distributed by days
 * - YYYY-MM-DD: amount for single day
 * - YYYY-MM-DD:YYYY-MM-DD: amount for date range, distributed by days
 */

import { prisma } from "@/lib/prisma";

export type ActualByEntity = {
  byDay: Map<string, Map<string, number>>; // entityId -> dateKey -> amount
  byMonth: Map<string, Map<string, number>>; // entityId -> monthKey -> amount
  byRange: Map<
    string,
    Array<{ start: string; end: string; amount: number; daysInRange: number }>
  >; // entityId -> ranges
};

function parseRange(period: string): { start: string; end: string } | null {
  const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  const [, start, end] = m;
  if (!start || !end) return null;
  return { start, end };
}

function daysBetween(startKey: string, endKey: string): number {
  const start = new Date(startKey + "T12:00:00");
  const end = new Date(endKey + "T12:00:00");
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

function isDateInRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

/**
 * Fetch ActualEntry for profile and date range, organized by entity and period type.
 */
export async function fetchActualEntriesBatch(
  profileId: string,
  entityIds: string[],
  startDate: Date,
  endDate: Date
): Promise<ActualByEntity> {
  const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const entries = await prisma.actualEntry.findMany({
    where: {
      profileId,
      entityId: { in: entityIds },
    },
  });

  const byDay = new Map<string, Map<string, number>>();
  const byMonth = new Map<string, Map<string, number>>();
  const byRange = new Map<
    string,
    Array<{ start: string; end: string; amount: number; daysInRange: number }>
  >();

  for (const e of entries) {
    const period = e.period;
    const amount = Number(e.amount);
    const entityId = e.entityId;

    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      if (period >= startKey && period <= endKey) {
        let map = byDay.get(entityId);
        if (!map) {
          map = new Map();
          byDay.set(entityId, map);
        }
        map.set(period, amount);
      }
    } else if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-").map(Number);
      const monthStart = `${y}-${m}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      if (monthEnd >= startKey && monthStart <= endKey) {
        let map = byMonth.get(entityId);
        if (!map) {
          map = new Map();
          byMonth.set(entityId, map);
        }
        map.set(period, amount);
      }
    } else {
      const range = parseRange(period);
      if (range && range.end >= startKey && range.start <= endKey) {
        const daysInRange = daysBetween(range.start, range.end);
        let arr = byRange.get(entityId);
        if (!arr) {
          arr = [];
          byRange.set(entityId, arr);
        }
        arr.push({
          start: range.start,
          end: range.end,
          amount,
          daysInRange,
        });
      }
    }
  }

  return { byDay, byMonth, byRange };
}

/**
 * Get daily amount for entity on date from actual data.
 * Returns amount to add for this day, or null if no actual data.
 */
export function getActualAmountForDay(
  entityId: string,
  entityType: "EXPENSE" | "INCOME",
  dateKey: string,
  monthKeyStr: string,
  actual: ActualByEntity
): number | null {
  // 1. Exact day match
  const dayMap = actual.byDay.get(entityId);
  if (dayMap) {
    const amt = dayMap.get(dateKey);
    if (amt != null) return amt;
  }

  // 2. Range match (day falls in range)
  const rangeArr = actual.byRange.get(entityId);
  if (rangeArr) {
    for (const r of rangeArr) {
      if (isDateInRange(dateKey, r.start, r.end)) {
        return r.amount / r.daysInRange;
      }
    }
  }

  // 3. Month match
  const monthMap = actual.byMonth.get(entityId);
  if (monthMap) {
    const monthAmt = monthMap.get(monthKeyStr);
    if (monthAmt != null) {
      const [y, m] = monthKeyStr.split("-").map(Number);
      const days = new Date(y, m, 0).getDate();
      return days > 0 ? monthAmt / days : 0;
    }
  }

  return null;
}
