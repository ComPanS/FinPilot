"use client";

import { useState, useCallback, useRef } from "react";
import { getForecastAction } from "@/app/actions/forecast";
import { saveScenarioAction, deleteScenarioAction } from "@/app/actions/what-if";
import { ForecastChart } from "@/components/cashflow/forecast-chart";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { WhatIfChanges } from "@/types";

type Scenario = { id: string; name: string; changesJson: unknown; createdAt: Date };

export function WhatIfSimulator({
  profileId,
  scenarios,
  forecastDays,
}: {
  profileId: string;
  scenarios: Scenario[];
  forecastDays: number;
}) {
  const [paymentDelay, setPaymentDelay] = useState(0);
  const [purchaseIncrease, setPurchaseIncrease] = useState(0);
  const [newEmployeeAmount, setNewEmployeeAmount] = useState(0);
  const [newEmployeeDate, setNewEmployeeDate] = useState("");
  const [forecast, setForecast] = useState<{ date: string; balance: number; inflows: number; outflows: number }[] | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(null);

  const loadForecast = useCallback(async () => {
    const changes: WhatIfChanges = {};
    if (paymentDelay > 0) changes.paymentDelayDays = paymentDelay;
    if (purchaseIncrease !== 0) changes.purchaseIncreasePercent = purchaseIncrease;
    if (newEmployeeAmount > 0 && newEmployeeDate) {
      changes.newEmployee = {
        startDate: newEmployeeDate,
        amount: newEmployeeAmount,
      };
    }
    const res = await getForecastAction(profileId, { days: forecastDays, changes });
    if (res?.forecast) setForecast(res.forecast);
  }, [profileId, forecastDays, paymentDelay, purchaseIncrease, newEmployeeAmount, newEmployeeDate]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSliderChange = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadForecast, 300);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Задержка оплаты клиентов (дней)</label>
            <input
              type="range"
              min="0"
              max="30"
              value={paymentDelay}
              onChange={(e) => {
                setPaymentDelay(Number(e.target.value));
                onSliderChange();
              }}
              className="mt-1 w-full"
            />
            <span className="text-sm text-muted-foreground">{paymentDelay} дней</span>
          </div>
          <div>
            <label className="block text-sm font-medium">Рост закупок (%)</label>
            <input
              type="range"
              min="-50"
              max="50"
              value={purchaseIncrease}
              onChange={(e) => {
                setPurchaseIncrease(Number(e.target.value));
                onSliderChange();
              }}
              className="mt-1 w-full"
            />
            <span className="text-sm text-muted-foreground">{purchaseIncrease > 0 ? "+" : ""}{purchaseIncrease}%</span>
          </div>
          <div>
            <label className="block text-sm font-medium">Новый сотрудник (с даты)</label>
            <input
              type="date"
              value={newEmployeeDate}
              onChange={(e) => {
                setNewEmployeeDate(e.target.value);
                onSliderChange();
              }}
              className="mt-1 rounded border border-border px-2 py-1"
            />
            <input
              type="number"
              placeholder="Зарплата"
              value={newEmployeeAmount || ""}
              onChange={(e) => {
                setNewEmployeeAmount(Number(e.target.value) || 0);
                onSliderChange();
              }}
              className="mt-1 ml-2 w-28 rounded border border-border px-2 py-1"
            />
          </div>
          <button
            onClick={loadForecast}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Пересчитать
          </button>
        </div>
        <div>
          {forecast && <ForecastChart data={forecast} />}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="font-semibold">Сохранить сценарий</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          До 10 сценариев. Текущие настройки будут сохранены.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Название сценария"
            className="rounded border border-border px-3 py-2"
          />
          <button
            onClick={async () => {
              if (!scenarioName.trim()) return;
              const changes: WhatIfChanges = {
                paymentDelayDays: paymentDelay || undefined,
                purchaseIncreasePercent: purchaseIncrease || undefined,
                newEmployee: newEmployeeAmount && newEmployeeDate
                  ? { startDate: newEmployeeDate, amount: newEmployeeAmount }
                  : undefined,
              };
              await saveScenarioAction(profileId, scenarioName, changes);
              setScenarioName("");
              window.location.reload();
            }}
            className="rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
          >
            Сохранить
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {scenarios.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-border p-3">
              <span>{s.name}</span>
              <button
                onClick={() => setDeleteScenarioId(s.id)}
                className="text-danger hover:underline"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </div>

      {deleteScenarioId && (
        <ConfirmDeleteModal
          title="Удаление сценария"
          message="Удалить этот сценарий?"
          onConfirm={async () => {
            await deleteScenarioAction(deleteScenarioId);
            window.location.reload();
          }}
          onCancel={() => setDeleteScenarioId(null)}
        />
      )}
    </div>
  );
}
