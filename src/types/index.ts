export type Frequency = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type TransactionType = "IN" | "OUT";

export interface ForecastDay {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export interface WhatIfChanges {
  incomeGrowthPercent?: number;
  expenseGrowthPercent?: number;
  expenseOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  incomeOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  manualOverrides?: Record<string, { amount?: number; hidden?: boolean }>;
  addExpenses?: Array<{ name: string; amount: number; frequency: string; categoryId: string }>;
  addIncomes?: Array<{ name: string; amount: number; frequency: string; categoryId?: string }>;
  addManual?: Array<{ date: string; type: "IN" | "OUT"; amount: number; description?: string }>;
}
