"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  updateExpense,
  updateIncome,
  updateManualTransaction,
} from "@/app/actions/cashflow";
import type { Prisma } from "@prisma/client";

type Category = { id: string; name: string; slug: string };

const expenseSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY", "CUSTOM"]),
  categoryId: z.string(),
  customDays: z.coerce.number().positive().optional(),
});

const incomeSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY", "CUSTOM"]),
  categoryId: z.string().optional(),
  customDays: z.coerce.number().positive().optional(),
});

const manualSchema = z.object({
  date: z.string(),
  type: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});

type ExpenseEntity = Prisma.RegularExpenseGetPayload<{ include: { category: true } }>;
type IncomeEntity = Prisma.RegularIncomeGetPayload<object>;
type ManualEntity = Prisma.ManualTransactionGetPayload<object>;

export function EditModal({
  entityType,
  entity,
  categories,
  currency,
  onClose,
  onSuccess,
}: {
  entityType: "EXPENSE" | "INCOME" | "MANUAL";
  entity: ExpenseEntity | IncomeEntity | ManualEntity;
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const expenseForm = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues:
      entityType === "EXPENSE"
        ? {
            name: (entity as ExpenseEntity).name,
            amount: Number((entity as ExpenseEntity).amount),
            frequency: (entity as ExpenseEntity).frequency as "MONTHLY" | "QUARTERLY" | "YEARLY" | "WEEKLY" | "DAILY" | "CUSTOM",
            categoryId: (entity as ExpenseEntity).categoryId,
            customDays: (entity as ExpenseEntity).customDays ?? undefined,
          }
        : undefined,
  });

  const incomeForm = useForm<z.infer<typeof incomeSchema>>({
    resolver: zodResolver(incomeSchema),
    defaultValues:
      entityType === "INCOME"
        ? {
            name: (entity as IncomeEntity).name,
            amount: Number((entity as IncomeEntity).amount ?? (entity as IncomeEntity).avgCheck ?? 0),
            frequency: ((entity as IncomeEntity).frequency ?? "MONTHLY") as "MONTHLY" | "QUARTERLY" | "YEARLY" | "WEEKLY" | "DAILY" | "CUSTOM",
            categoryId: (entity as IncomeEntity).categoryId ?? "",
            customDays: (entity as IncomeEntity).customDays ?? undefined,
          }
        : undefined,
  });

  const manualForm = useForm<z.infer<typeof manualSchema>>({
    resolver: zodResolver(manualSchema),
    defaultValues:
      entityType === "MANUAL"
        ? {
            date: new Date((entity as ManualEntity).date).toISOString().slice(0, 10),
            type: (entity as ManualEntity).type as "IN" | "OUT",
            amount: Number((entity as ManualEntity).amount),
            description: (entity as ManualEntity).description ?? "",
          }
        : undefined,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const onExpenseSubmit = expenseForm.handleSubmit(async (data) => {
    if (data.frequency === "CUSTOM" && (!data.customDays || data.customDays < 1)) {
      return;
    }
    await updateExpense((entity as ExpenseEntity).id, {
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId: data.categoryId,
      customDays: data.frequency === "CUSTOM" ? data.customDays : undefined,
    });
    onSuccess();
    onClose();
  });

  const onIncomeSubmit = incomeForm.handleSubmit(async (data) => {
    if (data.frequency === "CUSTOM" && (!data.customDays || data.customDays < 1)) {
      return;
    }
    await updateIncome((entity as IncomeEntity).id, {
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      categoryId: data.categoryId || undefined,
      customDays: data.frequency === "CUSTOM" ? data.customDays : undefined,
    });
    onSuccess();
    onClose();
  });

  const onManualSubmit = manualForm.handleSubmit(async (data) => {
    await updateManualTransaction((entity as ManualEntity).id, {
      date: new Date(data.date),
      type: data.type as "IN" | "OUT",
      amount: data.amount,
      description: data.description,
    });
    onSuccess();
    onClose();
  });

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
          <h3 className="text-lg font-semibold">Изменить</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        {entityType === "EXPENSE" && (
          <form onSubmit={onExpenseSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...expenseForm.register("name")} placeholder="Например: Аренда" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
              {expenseForm.formState.errors.name && <p className="mt-1 text-xs text-danger">{expenseForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма ({currency})</label>
              <input {...expenseForm.register("amount")} type="number" placeholder="0" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Частота</label>
              <select {...expenseForm.register("frequency")} className="w-full rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="MONTHLY">Ежемесячно</option>
                <option value="QUARTERLY">Ежеквартально</option>
                <option value="YEARLY">Раз в год</option>
                <option value="WEEKLY">Еженедельно</option>
                <option value="DAILY">Ежедневно</option>
                <option value="CUSTOM">Кастомный</option>
              </select>
            </div>
            {expenseForm.watch("frequency") === "CUSTOM" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Каждые (дней)</label>
                <input {...expenseForm.register("customDays")} type="number" min={1} placeholder="7" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
              <select {...expenseForm.register("categoryId")} className="w-full rounded border border-border bg-background px-2 py-1 text-foreground">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
                Сохранить
              </button>
              <button type="button" onClick={onClose} className="rounded border px-4 py-2">
                Отмена
              </button>
            </div>
          </form>
        )}

        {entityType === "INCOME" && (
          <form onSubmit={onIncomeSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Название</label>
              <input {...incomeForm.register("name")} placeholder="Например: Продажи" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма ({currency})</label>
              <input {...incomeForm.register("amount")} type="number" placeholder="0" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Частота</label>
              <select {...incomeForm.register("frequency")} className="w-full rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="MONTHLY">Ежемесячно</option>
                <option value="QUARTERLY">Ежеквартально</option>
                <option value="YEARLY">Раз в год</option>
                <option value="WEEKLY">Еженедельно</option>
                <option value="DAILY">Ежедневно</option>
                <option value="CUSTOM">Кастомный</option>
              </select>
            </div>
            {incomeForm.watch("frequency") === "CUSTOM" && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Каждые (дней)</label>
                <input {...incomeForm.register("customDays")} type="number" min={1} placeholder="7" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Категория</label>
              <select {...incomeForm.register("categoryId")} className="w-full rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
                Сохранить
              </button>
              <button type="button" onClick={onClose} className="rounded border px-4 py-2">
                Отмена
              </button>
            </div>
          </form>
        )}

        {entityType === "MANUAL" && (
          <form onSubmit={onManualSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Дата</label>
              <input {...manualForm.register("date")} type="date" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Тип</label>
              <select {...manualForm.register("type")} className="w-full rounded border border-border bg-background px-2 py-1 text-foreground">
                <option value="IN">Поступление</option>
                <option value="OUT">Расход</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Сумма ({currency})</label>
              <input {...manualForm.register("amount")} type="number" placeholder="0" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Описание</label>
              <input {...manualForm.register("description")} placeholder="Например: Покупка оборудования" className="w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark">
                Сохранить
              </button>
              <button type="button" onClick={onClose} className="rounded border px-4 py-2">
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
