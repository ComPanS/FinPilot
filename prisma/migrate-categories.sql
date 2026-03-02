-- Migration: Add IncomeCategory and update category relations
-- Run this before prisma db push

-- 1. Create IncomeCategory table
CREATE TABLE IF NOT EXISTS "IncomeCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "userId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "IncomeCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IncomeCategory_slug_key" UNIQUE ("slug")
);
CREATE INDEX IF NOT EXISTS "IncomeCategory_userId_idx" ON "IncomeCategory"("userId");

-- 2. Seed default income categories (use upsert to avoid duplicates)
INSERT INTO "IncomeCategory" ("id", "name", "slug", "userId", "isSystem") VALUES
  (gen_random_uuid()::text, 'Продажи', 'sales', NULL, true),
  (gen_random_uuid()::text, 'Услуги', 'services', NULL, true),
  (gen_random_uuid()::text, 'Зарплата', 'salary', NULL, true),
  (gen_random_uuid()::text, 'Инвестиции', 'investments', NULL, true),
  (gen_random_uuid()::text, 'Аренда', 'rent', NULL, true),
  (gen_random_uuid()::text, 'Прочее', 'other', NULL, true),
  (gen_random_uuid()::text, 'Своя категория', 'custom', NULL, true)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

-- 3. For ManualTransaction: add new columns
ALTER TABLE "ManualTransaction" ADD COLUMN IF NOT EXISTS "expenseCategoryId" TEXT;
ALTER TABLE "ManualTransaction" ADD COLUMN IF NOT EXISTS "incomeCategoryId" TEXT;

-- 4. Migrate ManualTransaction: copy categoryId to expenseCategoryId where type='OUT'
UPDATE "ManualTransaction" SET "expenseCategoryId" = "categoryId" WHERE "type" = 'OUT' AND "categoryId" IS NOT NULL;

-- 5. Drop old categoryId from ManualTransaction (after we've copied)
ALTER TABLE "ManualTransaction" DROP CONSTRAINT IF EXISTS "ManualTransaction_categoryId_fkey";
ALTER TABLE "ManualTransaction" DROP COLUMN IF EXISTS "categoryId";

-- 6. For RegularIncome: drop FK, update categoryId to point to IncomeCategory.other
ALTER TABLE "RegularIncome" DROP CONSTRAINT IF EXISTS "RegularIncome_categoryId_fkey";
UPDATE "RegularIncome" SET "categoryId" = (SELECT "id" FROM "IncomeCategory" WHERE "slug" = 'other' LIMIT 1) WHERE "categoryId" IS NOT NULL;
-- For rows with categoryId that was invalid (pointing to expense), set to other or null
UPDATE "RegularIncome" SET "categoryId" = (SELECT "id" FROM "IncomeCategory" WHERE "slug" = 'other' LIMIT 1) WHERE "categoryId" IS NOT NULL AND "categoryId" NOT IN (SELECT "id" FROM "IncomeCategory");
