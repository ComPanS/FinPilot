"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActualDataModal } from "./actual-data-modal";
import type { Prisma } from "@prisma/client";

type Profile = Prisma.CashFlowProfileGetPayload<{
  include: {
    regularExpenses: { include: { category: true } };
    regularIncomes: { include: { category: true } };
  };
}>;

export function FactPage({
  profile,
  currency,
  profileId,
}: {
  profile: Profile;
  currency: string;
  profileId: string;
}) {
  const [activeTab, setActiveTab] = useState<"expenses" | "incomes">("expenses");
  const [actualModal, setActualModal] = useState<{
    entityType: "EXPENSE" | "INCOME";
    entity: (typeof profile.regularExpenses)[0] | (typeof profile.regularIncomes)[0];
  } | null>(null);
  const router = useRouter();

  const freqLabel = (f: string, customDays?: number | null) =>
    f === "MONTHLY" ? "Ежемесячно"
    : f === "QUARTERLY" ? "Ежеквартально"
    : f === "YEARLY" ? "Раз в год"
    : f === "WEEKLY" ? "Еженедельно"
    : f === "DAILY" ? "Ежедневно"
    : f === "CUSTOM" && customDays ? `Каждые ${customDays} дн.`
    : "Кастомный";

  const incomeFreqLabel = (f: string, customDays?: number | null) =>
    f === "MONTHLY" ? "Ежемесячно"
    : f === "QUARTERLY" ? "Ежеквартально"
    : f === "YEARLY" ? "Раз в год"
    : f === "WEEKLY" ? "Еженедельно"
    : f === "DAILY" ? "Ежедневно"
    : f === "CUSTOM" && customDays ? `Каждые ${customDays} дн.`
    : "Кастомный";

  const onSuccess = () => {
    router.refresh();
  };

  const tabs = [
    { id: "expenses" as const, label: "Регулярные расходы" },
    { id: "incomes" as const, label: "Доходы" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`cursor-pointer border-b-2 px-4 py-2 font-medium ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "expenses" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Название</th>
                <th className="p-2 text-left">Сумма</th>
                <th className="p-2 text-left">Частота</th>
                <th className="p-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {profile.regularExpenses.map((e) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{Number(e.amount)} {currency}</td>
                  <td className="p-2">{freqLabel(e.frequency, e.customDays)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setActualModal({ entityType: "EXPENSE", entity: e })}
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Фактические данные
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profile.regularExpenses.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Нет регулярных расходов. Добавьте их в планировщике.
            </p>
          )}
        </div>
      )}

      {activeTab === "incomes" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left">Название</th>
                <th className="p-2 text-left">Сумма</th>
                <th className="p-2 text-left">Частота</th>
                <th className="p-2 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {profile.regularIncomes.map((i) => (
                <tr key={i.id} className="border-b border-border">
                  <td className="p-2">{i.name}</td>
                  <td className="p-2">{Number(i.amount ?? i.avgCheck ?? 0)} {currency}</td>
                  <td className="p-2">{incomeFreqLabel(i.frequency ?? "MONTHLY", i.customDays)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => setActualModal({ entityType: "INCOME", entity: i })}
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Фактические данные
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profile.regularIncomes.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              Нет регулярных доходов. Добавьте их в планировщике.
            </p>
          )}
        </div>
      )}

      {actualModal && (
        <ActualDataModal
          entityType={actualModal.entityType}
          entity={actualModal.entity}
          currency={currency}
          profileId={profileId}
          onClose={() => setActualModal(null)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
