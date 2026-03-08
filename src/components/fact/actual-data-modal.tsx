"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModalBodyClass } from "@/hooks/use-modal-body-class";
import { Pencil } from "lucide-react";
import { saveActualEntry, deleteActualEntry, getActualEntriesForEntity } from "@/app/actions/actual-data";
import { formatDateDdMmYyyy } from "@/lib/date-utils";

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type ExpenseEntity = {
  id: string;
  name: string;
  amount: unknown;
  frequency: string;
  customDays?: number | null;
  startDate: Date;
};
type IncomeEntity = {
  id: string;
  name: string;
  amount?: unknown;
  avgCheck?: unknown;
  frequency?: string;
  customDays?: number | null;
  startDate?: Date | null;
};

type InputMode = "month" | "day" | "range";

function periodToDateKeys(period: string): Set<string> {
  const keys = new Set<string>();
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const daysInMonth = new Date(y!, m!, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      keys.add(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    keys.add(period);
  } else {
    const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const start = new Date(m[1]! + "T12:00:00");
      const end = new Date(m[2]! + "T12:00:00");
      const current = new Date(start);
      while (current <= end) {
        keys.add(
          `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`,
        );
        current.setDate(current.getDate() + 1);
      }
    }
  }
  return keys;
}

function periodsOverlap(newPeriod: string, existingPeriods: string[], excludePeriod?: string): boolean {
  const newKeys = periodToDateKeys(newPeriod);
  if (newKeys.size === 0) return false;
  for (const p of existingPeriods) {
    if (p === excludePeriod) continue;
    const existingKeys = periodToDateKeys(p);
    for (const k of newKeys) {
      if (existingKeys.has(k)) return true;
    }
  }
  return false;
}

function formatPeriodLabel(period: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    return `${monthNames[(m ?? 1) - 1]} ${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return formatDateDdMmYyyy(period);
  }
  const m = period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    return `${formatDateDdMmYyyy(m[1]!)} – ${formatDateDdMmYyyy(m[2]!)}`;
  }
  return period;
}

export function ActualDataModal({
  entityType,
  entity,
  currency,
  profileId,
  onClose,
  onSuccess,
}: {
  entityType: "EXPENSE" | "INCOME";
  entity: ExpenseEntity | IncomeEntity;
  currency: string;
  profileId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [inputMode, setInputMode] = useState<InputMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [amountInput, setAmountInput] = useState("");
  const [items, setItems] = useState<{ period: string; label: string; amount: number; createdAt?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<{ period: string; amount: number } | null>(null);
  const router = useRouter();

  useModalBodyClass();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getActualEntriesForEntity(profileId, entityType, entity.id);
      if (cancelled) return;
      setLoading(false);
      if (res && "entries" in res && res.entries) {
        setItems(
          res.entries.map((e) => ({
            period: e.period,
            label: formatPeriodLabel(e.period),
            amount: e.amount,
            createdAt: e.createdAt,
          }))
        );
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profileId, entityType, entity.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const getPeriodFromInput = (): string | null => {
    if (inputMode === "month") return selectedMonth;
    if (inputMode === "day") return selectedDay;
    if (inputMode === "range") {
      if (rangeStart > rangeEnd) return null;
      return `${rangeStart}:${rangeEnd}`;
    }
    return null;
  };

  const handleStartEdit = (it: { period: string; label: string; amount: number }) => {
    setEditingItem({ period: it.period, amount: it.amount });
    setAmountInput(String(it.amount));
    if (/^\d{4}-\d{2}$/.test(it.period)) {
      setInputMode("month");
      setSelectedMonth(it.period);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(it.period)) {
      setInputMode("day");
      setSelectedDay(it.period);
    } else {
      const m = it.period.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
      if (m) {
        setInputMode("range");
        setRangeStart(m[1]!);
        setRangeEnd(m[2]!);
      }
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amountInput);
    if (Number.isNaN(num) || num < 0) return;
    const period = getPeriodFromInput();
    if (!period) return;

    if (inputMode === "month" && selectedMonth > currentMonthKey) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (inputMode === "day" && selectedDay > todayKey) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (inputMode === "range" && (rangeStart > todayKey || rangeEnd > todayKey)) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (periodsOverlap(period, items.map((i) => i.period), editingItem?.period)) {
      alert("Эта дата или диапазон уже введён");
      return;
    }

    setSaving(true);
    if (editingItem && editingItem.period !== period) {
      await deleteActualEntry(profileId, entityType, entity.id, editingItem.period);
    }
    const res = await saveActualEntry(profileId, entityType, entity.id, period, num);
    setSaving(false);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setAmountInput("");
    setEditingItem(null);
    const label = formatPeriodLabel(period);
    setItems((prev) => {
      const filtered = prev.filter((i) => i.period !== (editingItem?.period ?? period));
      return [...filtered, { period, label, amount: num, createdAt: new Date().toISOString() }].sort(
        (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    });
    onSuccess?.();
    router.refresh();
  };

  const handleAdd = async () => {
    if (editingItem) {
      handleSave();
      return;
    }
    const num = parseFloat(amountInput);
    if (Number.isNaN(num) || num < 0) return;
    const period = getPeriodFromInput();
    if (!period) return;

    if (inputMode === "month" && selectedMonth > currentMonthKey) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (inputMode === "day" && selectedDay > todayKey) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (inputMode === "range" && (rangeStart > todayKey || rangeEnd > todayKey)) {
      alert("Нельзя добавлять будущие даты");
      return;
    }
    if (periodsOverlap(period, items.map((i) => i.period))) {
      alert("Эта дата или диапазон уже введён");
      return;
    }

    setSaving(true);
    const res = await saveActualEntry(profileId, entityType, entity.id, period, num);
    setSaving(false);
    if (res?.error) {
      alert(res.error);
      return;
    }
    setAmountInput("");
    const label = formatPeriodLabel(period);
    setItems((prev) => {
      const filtered = prev.filter((i) => i.period !== period);
      return [...filtered, { period, label, amount: num, createdAt: new Date().toISOString() }].sort(
        (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    });
    onSuccess?.();
    router.refresh();
  };

  const handleRemove = async (period: string) => {
    const res = await deleteActualEntry(profileId, entityType, entity.id, period);
    if (res?.error) {
      alert(res.error);
      return;
    }
    if (editingItem?.period === period) {
      setEditingItem(null);
      setAmountInput("");
    }
    setItems((prev) => prev.filter((i) => i.period !== period));
    onSuccess?.();
    router.refresh();
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const handleCancelEdit = () => {
    setEditingItem(null);
    setAmountInput("");
  };

  const title = `Фактические данные: ${entity.name}`;

  return (
    <div
      className="modal-overlay fixed inset-0 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl mx-4 sm:mx-6 cursor-pointer overflow-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        <div className="mt-4 flex cursor-pointer flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-muted-foreground">Тип периода</label>
            <select
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value as InputMode)}
              className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
            >
              <option value="month">За месяц</option>
              <option value="day">За день</option>
              <option value="range">За диапазон дат</option>
            </select>
          </div>

          {inputMode === "month" && (
            <div>
              <label className="block text-xs text-muted-foreground">Месяц</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={currentMonthKey}
                className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
              />
            </div>
          )}

          {inputMode === "day" && (
            <div>
              <label className="block text-xs text-muted-foreground">Дата</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                max={todayKey}
                className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
              />
            </div>
          )}

          {inputMode === "range" && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground">Начало</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  max={todayKey}
                  className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Конец</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  max={todayKey}
                  className="mt-1 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-muted-foreground">Сумма ({currency})</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                else if (e.key === "Enter") {
                  e.preventDefault();
                  if (editingItem) handleSave();
                  else handleAdd();
                }
                else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              className="mt-1 w-28 cursor-pointer rounded border border-border bg-background px-2 py-1 text-foreground"
            />
          </div>

          <button
            type="button"
            onClick={editingItem ? handleSave : handleAdd}
            disabled={saving || !amountInput.trim()}
            className="cursor-pointer rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Сохранение…" : editingItem ? "Сохранить" : "Добавить"}
          </button>
          {editingItem && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="cursor-pointer rounded border px-4 py-2"
            >
              Отмена
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-4 cursor-pointer overflow-x-auto">
            <p className="mb-2 text-xs text-muted-foreground">Введённые фактические значения</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left">Период</th>
                  <th className="p-2 text-right">Сумма</th>
                  <th className="w-20 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.period} className="border-b border-border">
                    <td className="p-2">{it.label}</td>
                    <td className="p-2 text-right">
                      {it.amount.toLocaleString("ru")} {currency}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(it)}
                        className="mr-2 cursor-pointer text-muted-foreground hover:text-foreground"
                        title="Изменить"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(it.period)}
                        className="cursor-pointer text-danger hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading && items.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">Загрузка…</p>
        )}

        <div className="mt-4 flex cursor-pointer justify-end">
          <button onClick={onClose} className="cursor-pointer rounded border px-4 py-2">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
