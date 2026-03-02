"use client";

import { useState, useEffect } from "react";
import { updateExpense, updateIncome } from "@/app/actions/cashflow";

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type ExpenseEntity = { id: string; name: string; amount: unknown; frequency: string; customDays?: number | null; startDate: Date; expectedData?: Record<string, number> | null };
type IncomeEntity = { id: string; name: string; amount?: unknown; avgCheck?: unknown; frequency?: string; customDays?: number | null; startDate?: Date | null; salesPlan?: unknown; expectedData?: Record<string, number> | null };

export function ExpectedPeriodsModal({
  entityType,
  entity,
  currency,
  onClose,
  onSuccess,
  addMode,
  initialData,
  onSaveForAdd,
}: {
  entityType: "EXPENSE" | "INCOME";
  entity?: ExpenseEntity | IncomeEntity | null;
  currency: string;
  onClose: () => void;
  onSuccess?: () => void;
  addMode?: boolean;
  initialData?: Record<string, number>;
  onSaveForAdd?: (data: Record<string, number>) => void;
}) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const defaultMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [amountInput, setAmountInput] = useState("");
  const [items, setItems] = useState<{ key: string; label: string; amount: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const existingData = addMode ? initialData : (entity ? ((entity as ExpenseEntity).expectedData ?? (entity as IncomeEntity).expectedData) as Record<string, number> | null | undefined : undefined);

  useEffect(() => {
    const data = existingData ?? {};
    const list = Object.entries(data)
      .filter(([key, v]) => v != null && v > 0 && key >= currentMonthKey)
      .map(([key]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          key,
          label: `${monthNames[m - 1]} ${y}`,
          amount: data[key],
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    setItems(list);
  }, [entity?.id, addMode, initialData, currentMonthKey]);

  const handleAdd = () => {
    if (selectedMonth < currentMonthKey) {
      return;
    }
    const num = parseFloat(amountInput);
    if (Number.isNaN(num) || num <= 0) return;
    const [y, m] = selectedMonth.split("-").map(Number);
    const label = `${monthNames[m - 1]} ${y}`;
    setItems((prev) => {
      const filtered = prev.filter((i) => i.key !== selectedMonth);
      return [...filtered, { key: selectedMonth, label, amount: num }].sort((a, b) => a.key.localeCompare(b.key));
    });
    setAmountInput("");
  };

  const handleRemove = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const handleSave = async () => {
    const expectedData: Record<string, number> = {};
    for (const it of items) {
      expectedData[it.key] = it.amount;
    }
    setSaving(true);
    try {
      if (addMode && onSaveForAdd) {
        onSaveForAdd(expectedData);
        onClose();
      } else if (entity) {
        if (entityType === "EXPENSE") {
          await updateExpense((entity as ExpenseEntity).id, { expectedData: Object.keys(expectedData).length > 0 ? expectedData : {} });
        } else {
          await updateIncome((entity as IncomeEntity).id, { expectedData: Object.keys(expectedData).length > 0 ? expectedData : {} });
        }
        onSuccess?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const title = addMode ? "Ожидаемые данные" : `Ожидаемые данные: ${entity?.name ?? ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">Месяц</label>
            <input
              type="month"
              value={selectedMonth}
              min={currentMonthKey}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="mt-1 rounded border border-border bg-background px-2 py-1 text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Сумма ({currency})</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
              className="mt-1 w-28 rounded border border-border bg-background px-2 py-1 text-foreground"
            />
          </div>
          <button type="button" onClick={handleAdd} className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
            Добавить
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Месяц</th>
                  <th className="p-2 text-right">Сумма</th>
                  <th className="w-10 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key} className="border-b border-border">
                    <td className="p-2">{it.label}</td>
                    <td className="p-2 text-right">{it.amount.toLocaleString("ru")} {currency}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleRemove(it.key)}
                        className="cursor-pointer text-danger hover:underline"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50">
            {saving ? "Сохранение…" : addMode ? "Готово" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
