/**
 * ExpectedDataService — centralized resolution of effective amounts for forecast.
 *
 * Hierarchy (priority top to bottom):
 * 1. ProfileMonthlyData / ExpectedEntry MONTHLY_TOTAL
 * 2. ExpectedEntry (entity-specific) for period
 * 3. seasonalMultiplier × base amount
 * 4. base amount / frequency (dailyAmount)
 * 5. AI forecast (fallback)
 */

import { prisma } from "@/lib/prisma";
import type { RegularExpense, RegularIncome } from "@prisma/client";

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Daily amount from frequency when base amount is per-occurrence (not monthly total).
 */
export function dailyAmountFromFrequency(
  freq: string,
  amount: number,
  customDays?: number | null
): number {
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

/**
 * Daily amount when base amount is monthly total (e.g. from ExpectedEntry).
 * Uses actual days in month.
 */
export function dailyAmountFromMonthlyTotal(
  monthlyAmount: number,
  date: Date,
  freq?: string
): number {
  const days = daysInMonth(date);
  if (days <= 0) return 0;
  // ExpectedEntry stores monthly total; distribute evenly over days
  return monthlyAmount / days;
}

export function getSeasonalMultiplier(
  seasonalMultiplier: Record<string, number> | null | undefined,
  date: Date
): number {
  if (!seasonalMultiplier || typeof seasonalMultiplier !== "object") return 1.0;
  const monthStr = String(date.getMonth() + 1).padStart(2, "0");
  const mult = seasonalMultiplier[monthStr];
  return mult != null && !Number.isNaN(Number(mult)) ? Number(mult) : 1.0;
}

export type EntityWithExpected = (RegularExpense | RegularIncome) & {
  expectedData?: unknown;
  seasonalMultiplier?: unknown;
};

/**
 * Batch-fetch ExpectedEntry for profile and date range.
 * Returns Map<entityId, Map<period, amount>> for EXPENSE/INCOME,
 * and monthly totals for MONTHLY_TOTAL.
 */
export async function fetchExpectedEntriesBatch(
  profileId: string,
  monthKeys: string[],
  entityIds?: string[]
) {
  const entries = await prisma.expectedEntry.findMany({
    where:
      entityIds && entityIds.length > 0
        ? {
            profileId,
            period: { in: monthKeys },
            OR: [
              { entityId: { in: entityIds } },
              { entityType: "MONTHLY_TOTAL" },
            ],
          }
        : {
            profileId,
            period: { in: monthKeys },
          },
  });

  const byEntity = new Map<string, Map<string, number>>();
  const monthlyTotal = new Map<string, { income: number; expense: number }>();

  for (const e of entries) {
    if (e.entityType === "MONTHLY_TOTAL") {
      const existing = monthlyTotal.get(e.period) ?? { income: 0, expense: 0 };
      if (e.entityId === "income") {
        existing.income = Number(e.amount);
      } else if (e.entityId === "expense") {
        existing.expense = Number(e.amount);
      }
      monthlyTotal.set(e.period, existing);
    } else if (e.entityId) {
      let perEntity = byEntity.get(e.entityId);
      if (!perEntity) {
        perEntity = new Map();
        byEntity.set(e.entityId, perEntity);
      }
      perEntity.set(e.period, Number(e.amount));
    }
  }

  return { byEntity, monthlyTotal };
}

/**
 * Get effective amount for entity for a specific month.
 * Merges ExpectedEntry, expectedData (JSON), seasonalMultiplier, base amount.
 */
export function getEffectiveMonthlyAmount(
  entity: EntityWithExpected,
  period: string,
  baseAmount: number,
  expectedByEntity: Map<string, number> | undefined,
  expectedDataJson: Record<string, number> | null | undefined,
  useExpectedData: boolean
): number {
  if (!useExpectedData) return baseAmount;

  // 1. ExpectedEntry (entity-specific)
  const fromEntry = expectedByEntity?.get(period);
  if (fromEntry != null && !Number.isNaN(fromEntry)) return fromEntry;

  // 2. expectedData JSON (backward compatibility)
  if (expectedDataJson) {
    const fromJson = expectedDataJson[period];
    if (fromJson != null && !Number.isNaN(fromJson)) return fromJson;
  }

  // 3. Base amount (seasonal multiplier applied in caller)
  return baseAmount;
}

/**
 * Get effective daily amount for an entity on a date.
 * Used when we have monthly amount and need to distribute to daily.
 */
export function getEffectiveDailyAmountForMonth(
  entity: EntityWithExpected,
  date: Date,
  monthlyAmount: number,
  isIncome: boolean,
  taxPct?: number
): number {
  const days = daysInMonth(date);
  if (days <= 0) return 0;

  let amount = monthlyAmount;
  if (isIncome && taxPct != null && taxPct > 0) {
    amount = monthlyAmount * (1 - taxPct / 100);
  }

  const seasonal = getSeasonalMultiplier(
    entity.seasonalMultiplier as Record<string, number> | null | undefined,
    date
  );
  amount *= seasonal;

  return amount / days;
}
