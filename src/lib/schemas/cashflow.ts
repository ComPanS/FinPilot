import { z } from "zod";

const frequencySchema = z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY", "CUSTOM"]);

const expectedDataSchema = z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().min(0));
const seasonalMultiplierSchema = z.record(z.string().regex(/^\d{2}$/), z.number().min(0).max(10));

export const createExpenseSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(500),
  amount: z.number().min(0),
  frequency: frequencySchema,
  categoryId: z.string().min(1),
  customDays: z.number().int().min(1).max(365).optional(),
  expectedData: expectedDataSchema.optional(),
  seasonalMultiplier: seasonalMultiplierSchema.optional(),
});

export const createIncomeSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(500),
  amount: z.number().min(0).optional(),
  avgCheck: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  frequency: frequencySchema.default("MONTHLY"),
  categoryId: z.string().optional(),
  customDays: z.number().int().min(1).max(365).optional(),
  expectedData: expectedDataSchema.optional(),
  seasonalMultiplier: seasonalMultiplierSchema.optional(),
  salesPlan: z.record(z.string(), z.number().min(0)).optional(),
});

export const createManualTransactionSchema = z.object({
  profileId: z.string().min(1),
  date: z.coerce.date(),
  type: z.enum(["IN", "OUT"]),
  amount: z.number().min(0),
  description: z.string().max(1000).optional(),
  expenseCategoryId: z.string().optional(),
  incomeCategoryId: z.string().optional(),
  taxes: z.number().min(0).optional(),
});

export const updateExpenseSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  amount: z.number().min(0).optional(),
  frequency: frequencySchema.optional(),
  categoryId: z.string().min(1).optional(),
  customDays: z.number().int().min(1).max(365).optional().nullable(),
  expectedData: expectedDataSchema.optional(),
  seasonalMultiplier: seasonalMultiplierSchema.optional(),
});
