/**
 * Run with: npx tsx prisma/migrate-categories.ts
 * Migrates from ExpenseCategory to IncomeCategory for incomes and manual transactions
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create IncomeCategory table and seed (Prisma will handle via schema)
  // We need to run raw SQL for the migration
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IncomeCategory" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "userId" TEXT,
      "isSystem" BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "IncomeCategory_slug_key" UNIQUE ("slug")
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "IncomeCategory" ("id", "name", "slug", "userId", "isSystem") VALUES
      (gen_random_uuid()::text, 'Продажи', 'sales', NULL, true),
      (gen_random_uuid()::text, 'Услуги', 'services', NULL, true),
      (gen_random_uuid()::text, 'Зарплата', 'salary', NULL, true),
      (gen_random_uuid()::text, 'Инвестиции', 'investments', NULL, true),
      (gen_random_uuid()::text, 'Аренда', 'rent', NULL, true),
      (gen_random_uuid()::text, 'Прочее', 'other', NULL, true),
      (gen_random_uuid()::text, 'Своя категория', 'custom', NULL, true)
    ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name"
  `);

  // 2. Add columns to ManualTransaction if not exist
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ManualTransaction" ADD COLUMN IF NOT EXISTS "expenseCategoryId" TEXT
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ManualTransaction" ADD COLUMN IF NOT EXISTS "incomeCategoryId" TEXT
    `);
  } catch (e) {
    console.log("Columns may already exist:", e);
  }

  // 3. Migrate ManualTransaction
  await prisma.$executeRawUnsafe(`
    UPDATE "ManualTransaction" SET "expenseCategoryId" = "categoryId" WHERE "type" = 'OUT' AND "categoryId" IS NOT NULL
  `);

  // 4. Drop old FK and column from ManualTransaction
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ManualTransaction" DROP CONSTRAINT IF EXISTS "ManualTransaction_categoryId_fkey"
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ManualTransaction" DROP COLUMN IF EXISTS "categoryId"
    `);
  } catch (e) {
    console.log("ManualTransaction migration:", e);
  }

  // 5. Migrate RegularIncome - drop FK, update categoryId to IncomeCategory.other
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "RegularIncome" DROP CONSTRAINT IF EXISTS "RegularIncome_categoryId_fkey"
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "RegularIncome" ri SET "categoryId" = (SELECT "id" FROM "IncomeCategory" WHERE "slug" = 'other' LIMIT 1)
      WHERE ri."categoryId" IS NOT NULL
    `);
  } catch (e) {
    console.log("RegularIncome migration:", e);
  }

  console.log("Migration completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
