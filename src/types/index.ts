export type Frequency = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type TransactionType = "IN" | "OUT";

export interface ForecastDay {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export interface WhatIfChanges {
  paymentDelayDays?: number;
  purchaseIncreasePercent?: number;
  newEmployee?: { startDate: string; amount: number };
}
