/**
 * Run with: npx tsx prisma/fix-income-category.ts
 * Fixes RegularIncome to use IncomeCategory
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Drop FK from RegularIncome to ExpenseCategory
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "RegularIncome" DROP CONSTRAINT IF EXISTS "RegularIncome_categoryId_fkey"
  `);

  // Update RegularIncome: set categoryId to IncomeCategory.other
  await prisma.$executeRawUnsafe(`
    UPDATE "RegularIncome" SET "categoryId" = (SELECT "id" FROM "IncomeCategory" WHERE "slug" = 'other' LIMIT 1)
    WHERE "categoryId" IS NOT NULL
  `);

  // Set null for any that don't have valid IncomeCategory
  await prisma.$executeRawUnsafe(`
    UPDATE "RegularIncome" SET "categoryId" = NULL
    WHERE "categoryId" IS NOT NULL AND "categoryId" NOT IN (SELECT "id" FROM "IncomeCategory")
  `);

  console.log("RegularIncome migration completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
