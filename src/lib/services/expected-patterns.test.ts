import { describe, it, expect } from "vitest";
import { applyMonthlyScaling } from "./expected-patterns";

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

describe("Income/Expense separation in expected-patterns", () => {
  it("monthly.income goes ONLY to inflows; monthly.expense goes ONLY to outflows", () => {
    const startDate = new Date(2025, 0, 1); // Jan 1, 2025
    const days = 31;
    const monthlyByMonth = new Map<string, { income: number; expense: number }>([
      ["2025-01", { income: 100_000, expense: 50_000 }],
    ]);

    const { inflows, outflows } = applyMonthlyScaling(
      null,
      monthlyByMonth,
      dateKey,
      addDays,
      monthKey,
      startDate,
      days,
      1,
      1,
    );

    const totalInflows = Object.values(inflows).reduce((a, b) => a + b, 0);
    const totalOutflows = Object.values(outflows).reduce((a, b) => a + b, 0);

    expect(totalInflows).toBeCloseTo(100_000, 0);
    expect(totalOutflows).toBeCloseTo(50_000, 0);
  });

  it("one-time expense (manual OUT) must not appear in inflows", () => {
    const startDate = new Date(2025, 0, 1);
    const days = 31;
    const monthlyByMonth = new Map<string, { income: number; expense: number }>([
      ["2025-01", { income: 10_000, expense: 30_000 }],
    ]);

    const { inflows, outflows } = applyMonthlyScaling(
      null,
      monthlyByMonth,
      dateKey,
      addDays,
      monthKey,
      startDate,
      days,
      1,
      1,
    );

    const totalInflows = Object.values(inflows).reduce((a, b) => a + b, 0);
    const totalOutflows = Object.values(outflows).reduce((a, b) => a + b, 0);

    expect(totalInflows).toBeCloseTo(10_000, 0);
    expect(totalOutflows).toBeCloseTo(30_000, 0);
    expect(totalInflows).not.toBe(totalOutflows);
  });
});
