"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { completeOnboarding } from "@/app/actions/onboarding";

const step1Schema = z.object({
  businessName: z.string().min(2, "Минимум 2 символа"),
});

const step2Schema = z.object({
  currency: z.enum(["RUB", "USD", "EUR"]),
});

const step3ItemSchema = z.object({
  type: z.enum(["expense", "income"]),
  name: z.string().min(1, "Обязательно"),
  amount: z.coerce.number().positive("Положительное число"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Item = z.infer<typeof step3ItemSchema>;

export function OnboardingWizard() {
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
    const result = await completeOnboarding({
      businessName: step1Form.getValues("businessName"),
      currency: step2Form.getValues("currency"),
      items,
      aiText: aiText.trim() || undefined,
    });
    setAiLoading(false);
    if (result?.error) {
      alert(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function addItem() {
    if (items.length >= 5) return;
    setItems([...items, { type: "expense", name: "", amount: 0, frequency: "MONTHLY" }]);
  }

  function updateItem(i: number, field: keyof Step3Item, value: unknown) {
    const next = [...items];
    (next[i] as Record<string, unknown>)[field] = value;
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
              <input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Введите текст..."
                className="flex-1 rounded border border-border bg-background px-3 py-2"
                disabled={aiLoading}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Или добавьте вручную до 5 регулярных расходов или доходов (можно пропустить)
          </p>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 rounded-lg border border-border p-3">
              <select
                value={item.type}
                onChange={(e) => updateItem(i, "type", e.target.value)}
                className="rounded border border-border px-2 py-1"
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
              <input
                value={item.name}
                onChange={(e) => updateItem(i, "name", e.target.value)}
                placeholder="Название"
                className="flex-1 rounded border border-border px-2 py-1"
              />
              <input
                type="number"
                min={0}
                value={item.amount || ""}
                onChange={(e) => updateItem(i, "amount", Number(e.target.value) || 0)}
                onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                placeholder="Сумма"
                className="w-24 rounded border border-border px-2 py-1"
              />
              {item.type === "expense" && (
                <select
                  value={item.frequency}
                  onChange={(e) => updateItem(i, "frequency", e.target.value)}
                  className="rounded border border-border px-2 py-1"
                >
                  <option value="MONTHLY">Ежемесячно</option>
                  <option value="QUARTERLY">Ежеквартально</option>
                  <option value="YEARLY">Раз в год</option>
                </select>
              )}
            </div>
          ))}
          {items.length < 5 && (
            <button
              type="button"
              onClick={addItem}
              className="text-sm text-primary hover:underline"
            >
              + Добавить
            </button>
          )}
          <button
            type="button"
            onClick={handleStep3}
            disabled={aiLoading}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {aiLoading ? "Обработка..." : "Завершить"}
          </button>
        </div>
      )}
    </div>
  );
}
