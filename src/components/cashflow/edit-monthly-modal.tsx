"use client";

import { useEffect, useState } from "react";

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export function EditMonthlyModal({
  month,
  income,
  expense,
  currency,
  onSave,
  onClose,
}: {
  month: string;
  income: number;
  expense: number;
  currency: string;
  onSave: (income: number, expense: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [incomeVal, setIncomeVal] = useState(String(income));
  const [expenseVal, setExpenseVal] = useState(String(expense));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    const inc = Math.max(0, parseFloat(incomeVal) || 0);
    const exp = Math.max(0, parseFloat(expenseVal) || 0);
    setSaving(true);
    const ok = await onSave(inc, exp);
    setSaving(false);
    if (ok) onClose();
  };

  const [y, mo] = month.split("-").map(Number);
  const label = `${monthNames[mo - 1]} ${y}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">Изменить данные за {label}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Доход ({currency})</label>
            <input
              type="number"
              min={0}
              value={incomeVal}
              onChange={(e) => setIncomeVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
              className="w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Расход ({currency})</label>
            <input
              type="number"
              min={0}
              value={expenseVal}
              onChange={(e) => setExpenseVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
              className="w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
