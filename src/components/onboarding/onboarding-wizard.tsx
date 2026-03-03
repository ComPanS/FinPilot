"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { completeOnboarding } from "@/app/actions/onboarding";
import { addProfileWithSetupAction } from "@/app/actions/profiles";
import { parseCashFlowTextPreviewAction } from "@/app/actions/ai-cashflow";

const step1Schema = z.object({
  businessName: z.string().min(2, "Минимум 2 символа"),
});

const step2Schema = z.object({
  currency: z.enum(["RUB", "USD", "EUR"]),
});

const FREQUENCIES = [
  { value: "MONTHLY", label: "Ежемесячно" },
  { value: "QUARTERLY", label: "Ежеквартально" },
  { value: "YEARLY", label: "Раз в год" },
  { value: "WEEKLY", label: "Еженедельно" },
  { value: "DAILY", label: "Ежедневно" },
] as const;

const step3ItemSchema = z.object({
  type: z.enum(["expense", "income"]),
  name: z.string().min(1, "Обязательно"),
  amount: z.coerce.number().positive("Положительное число"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "DAILY"]).optional(),
  taxes: z.coerce.number().min(0).optional(),
  categoryId: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Item = z.infer<typeof step3ItemSchema>;

type Category = { id: string; name: string; slug: string };

export function OnboardingWizard({
  mode = "onboarding",
  expenseCategories = [],
  incomeCategories = [],
}: {
  mode?: "onboarding" | "addProfile";
  expenseCategories?: Category[];
  incomeCategories?: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<Step3Item[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { businessName: "" },
  });

  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { currency: "RUB" },
  });

  async function handleStep1(data: Step1Data) {
    setStep(2);
  }

  async function handleStep2(data: Step2Data) {
    setStep(3);
  }

  async function handleStep3() {
    setAiLoading(true);
    const data = {
      businessName: step1Form.getValues("businessName"),
      currency: step2Form.getValues("currency"),
      items: items
        .filter((it) => it.name && it.amount > 0)
        .map((it) => ({
          type: it.type,
          name: it.name,
          amount: it.amount,
          frequency: it.frequency ?? "MONTHLY",
          taxes: it.taxes ?? 0,
          categoryId: it.categoryId,
        })),
    };
    const result =
      mode === "addProfile"
        ? await addProfileWithSetupAction(data)
        : await completeOnboarding(data);
    setAiLoading(false);
    if (result?.error) {
      alert(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleAiAdd() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    const result = await parseCashFlowTextPreviewAction(aiText.trim());
    setAiLoading(false);
    if (result?.error) {
      alert(result.error);
      return;
    }
    if (result?.items?.length) {
      const newItems: Step3Item[] = result.items.map((it) => {
        const cat =
          it.type === "expense"
            ? expenseCategories.find((c) => c.slug === (it.categorySlug ?? "other")) ?? expenseCategories[0]
            : incomeCategories.find((c) => c.slug === (it.categorySlug ?? "other")) ?? incomeCategories[0];
        return {
          type: it.type,
          name: it.name,
          amount: it.amount,
          frequency: (it.frequency as Step3Item["frequency"]) ?? "MONTHLY",
          taxes: it.taxes ?? 0,
          categoryId: cat?.id,
        };
      });
      setItems((prev) => {
        const next = [...prev, ...newItems];
        return next.slice(0, 20);
      });
      setAiText("");
    }
  }

  function addItem() {
    if (items.length >= 20) return;
    setItems([
      ...items,
      {
        type: "expense" as const,
        name: "",
        amount: 0,
        frequency: "MONTHLY",
        taxes: 0,
        categoryId: expenseCategories[0]?.id,
      },
    ]);
  }

  function updateItem(i: number, field: keyof Step3Item, value: unknown) {
    const next = [...items];
    (next[i] as Record<string, unknown>)[field] = value;
    if (field === "type") {
      const cats = value === "income" ? incomeCategories : expenseCategories;
      (next[i] as Step3Item).categoryId = cats[0]?.id;
    }
    setItems(next);
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${
              s <= step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <form
          onSubmit={step1Form.handleSubmit(handleStep1)}
          className="space-y-4 rounded-xl border border-border bg-surface p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Название бизнеса</label>
            <input
              {...step1Form.register("businessName")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Кофе с собой"
            />
            {step1Form.formState.errors.businessName && (
              <p className="mt-1 text-sm text-danger">
                {step1Form.formState.errors.businessName.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          >
            Далее
          </button>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={step2Form.handleSubmit(handleStep2)}
          className="space-y-4 rounded-xl border border-border bg-surface p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Валюта</label>
            <select
              {...step2Form.register("currency")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="RUB">Рубли (RUB)</option>
              <option value="USD">Доллары (USD)</option>
              <option value="EUR">Евро (EUR)</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          >
            Далее
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <label className="block text-sm font-medium">Добавить текстом (ИИ обработает)</label>
            <p className="mt-1 text-xs text-muted-foreground">
              Например: «аренда 50000 ежемесячно», «продажи 100000 в марте», «расход 15000 15.03»
            </p>
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Текст</label>
                <input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAiAdd())}
                placeholder="Введите текст..."
                className="w-full rounded border border-border bg-background px-3 py-2"
                disabled={aiLoading}
              />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Добавить</label>
              <button
                type="button"
                onClick={handleAiAdd}
                disabled={aiLoading || !aiText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary hover:bg-primary/10 disabled:opacity-50"
                title="Добавить"
              >
                <Plus className="h-5 w-5" />
              </button>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Или добавьте вручную до 20 регулярных расходов или доходов (можно пропустить)
          </p>
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-4 rounded-lg border border-border p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Тип</label>
                <select
                  value={item.type}
                  onChange={(e) =>
                    updateItem(i, "type", e.target.value as "expense" | "income")
                  }
                  className="rounded border border-border px-2 py-1"
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Категория</label>
                <select
                  value={item.categoryId ?? ""}
                  onChange={(e) => updateItem(i, "categoryId", e.target.value)}
                  className="rounded border border-border px-2 py-1"
                >
                  {(item.type === "expense" ? expenseCategories : incomeCategories).map(
                    (c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Название</label>
                <input
                  value={item.name}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  placeholder="Название"
                  className="w-full rounded border border-border px-2 py-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Сумма</label>
                <input
                  type="number"
                  min={0}
                  value={item.amount || ""}
                  onChange={(e) =>
                    updateItem(i, "amount", Number(e.target.value) || 0)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E")
                      e.preventDefault();
                  }}
                  placeholder="0"
                  className="w-24 rounded border border-border px-2 py-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Частота</label>
                <select
                  value={item.frequency ?? "MONTHLY"}
                  onChange={(e) => updateItem(i, "frequency", e.target.value)}
                  className="rounded border border-border px-2 py-1"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              {item.type === "income" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Налог</label>
                  <input
                    type="number"
                    min={0}
                    value={item.taxes ?? 0}
                    onChange={(e) =>
                      updateItem(i, "taxes", Number(e.target.value) || 0)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E")
                        e.preventDefault();
                    }}
                    placeholder="0"
                    className="w-20 rounded border border-border px-2 py-1"
                  />
                </div>
              )}
            </div>
          ))}
          {items.length < 20 && (
            <button
              type="button"
              onClick={addItem}
              className="text-sm text-primary hover:underline"
            >
              + Добавить
            </button>
          )}
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={handleStep3}
              disabled={aiLoading}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {aiLoading ? "Обработка..." : "Завершить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
