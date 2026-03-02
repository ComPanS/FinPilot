"use client";

import { useEffect } from "react";

type Income = { id: string; name: string; amount?: number; avgCheck?: number; frequency: string; taxes?: number };

export function IncomeLogger({ incomes }: { incomes: Income[] }) {
  useEffect(() => {
    const data = incomes.map((i) => ({
      id: i.id,
      name: i.name,
      amount: Number(i.amount ?? i.avgCheck ?? 0),
      frequency: i.frequency,
      taxes: i.taxes != null ? Number(i.taxes) : 0,
    }));
    const total = data.reduce((s, i) => s + i.amount, 0);
    console.log("[FinPilot] Доходы:", data);
    console.log("[FinPilot] Сумма доходов:", total);
  }, [incomes]);
  return null;
}
