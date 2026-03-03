/**
 * Migration script: expectedData (JSON) -> ExpectedEntry (normalized table)
 *
 * Run with: npx tsx scripts/migrate-expected-data.ts
 *
 * For each RegularExpense/RegularIncome with non-empty expectedData:
 * - Creates ExpectedEntry for each (entityId, period) with source="MANUAL"
 *
 * Optionally migrates ProfileMonthlyData to ExpectedEntry with entityType="MONTHLY_TOTAL"
 * (uses entityId "income" | "expense" to distinguish)
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting expectedData migration...");

  let expenseCount = 0;
  let incomeCount = 0;
  let monthlyCount = 0;

  // Migrate RegularExpense expectedData
  const expenses = await prisma.regularExpense.findMany({
    where: { expectedData: { not: Prisma.JsonNull } },
  });

  for (const exp of expenses) {
    const data = exp.expectedData as Record<string, number> | null | undefined;
    if (!data || typeof data !== "object") continue;

    for (const [period, amount] of Object.entries(data)) {
      if (period == null || amount == null || Number.isNaN(Number(amount))) continue;
      const num = Number(amount);
      if (num <= 0) continue;

      // Validate period format YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(period)) continue;

      try {
        await prisma.expectedEntry.upsert({
          where: {
            profileId_entityType_entityId_period: {
              profileId: exp.profileId,
              entityType: "EXPENSE",
              entityId: exp.id,
              period,
            },
          },
          create: {
            profileId: exp.profileId,
            entityType: "EXPENSE",
            entityId: exp.id,
            period,
            amount: num,
            source: "MANUAL",
            confidence: 1.0,
          },
          update: { amount: num },
        });
        expenseCount++;
      } catch (e) {
        console.error(`Failed to migrate expense ${exp.id} period ${period}:`, e);
      }
    }
  }

  // Migrate RegularIncome expectedData
  const incomes = await prisma.regularIncome.findMany({
    where: { expectedData: { not: Prisma.JsonNull } },
  });

  for (const inc of incomes) {
    const data = inc.expectedData as Record<string, number> | null | undefined;
    if (!data || typeof data !== "object") continue;

    for (const [period, amount] of Object.entries(data)) {
      if (period == null || amount == null || Number.isNaN(Number(amount))) continue;
      const num = Number(amount);
      if (num <= 0) continue;

      if (!/^\d{4}-\d{2}$/.test(period)) continue;

      try {
        await prisma.expectedEntry.upsert({
          where: {
            profileId_entityType_entityId_period: {
              profileId: inc.profileId,
              entityType: "INCOME",
              entityId: inc.id,
              period,
            },
          },
          create: {
            profileId: inc.profileId,
            entityType: "INCOME",
            entityId: inc.id,
            period,
            amount: num,
            source: "MANUAL",
            confidence: 1.0,
          },
          update: { amount: num },
        });
        incomeCount++;
      } catch (e) {
        console.error(`Failed to migrate income ${inc.id} period ${period}:`, e);
      }
    }
  }

  // Optionally migrate ProfileMonthlyData to ExpectedEntry (MONTHLY_TOTAL)
  const monthlyData = await prisma.profileMonthlyData.findMany();

  for (const m of monthlyData) {
    if (!/^\d{4}-\d{2}$/.test(m.month)) continue;

    try {
      if (Number(m.income) > 0) {
        await prisma.expectedEntry.upsert({
          where: {
            profileId_entityType_entityId_period: {
              profileId: m.profileId,
              entityType: "MONTHLY_TOTAL",
              entityId: "income",
              period: m.month,
            },
          },
          create: {
            profileId: m.profileId,
            entityType: "MONTHLY_TOTAL",
            entityId: "income",
            period: m.month,
            amount: m.income,
            source: "MANUAL",
            confidence: 1.0,
          },
          update: { amount: m.income },
        });
        monthlyCount++;
      }
      if (Number(m.expense) > 0) {
        await prisma.expectedEntry.upsert({
          where: {
            profileId_entityType_entityId_period: {
              profileId: m.profileId,
              entityType: "MONTHLY_TOTAL",
              entityId: "expense",
              period: m.month,
            },
          },
          create: {
            profileId: m.profileId,
            entityType: "MONTHLY_TOTAL",
            entityId: "expense",
            period: m.month,
            amount: m.expense,
            source: "MANUAL",
            confidence: 1.0,
          },
          update: { amount: m.expense },
        });
        monthlyCount++;
      }
    } catch (e) {
      console.error(`Failed to migrate monthly ${m.profileId} ${m.month}:`, e);
    }
  }

  console.log(`Migration complete. Created/updated:`);
  console.log(`  - Expense entries: ${expenseCount}`);
  console.log(`  - Income entries: ${incomeCount}`);
  console.log(`  - Monthly total entries: ${monthlyCount}`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
