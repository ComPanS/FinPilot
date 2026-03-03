"use client";

import { useEffect, useState } from "react";
import { getCashFlowHistory } from "@/app/actions/cashflow";
import { formatDateToDdMmYyyy } from "@/lib/date-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type HistoryItem = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldData: unknown;
  newData: unknown;
  createdAt: Date;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
};

function formatDataReadable(d: unknown, currency: string): string {
  if (!d || typeof d !== "object") return "-";
  const obj = d as Record<string, unknown>;
  const parts: string[] = [];
  if (obj.name != null) parts.push(`${obj.name}`);
  if (obj.amount != null) parts.push(`${Number(obj.amount).toLocaleString("ru")} ${currency}`);
  if (obj.taxes != null && Number(obj.taxes) > 0) parts.push(`налоги ${Number(obj.taxes)}%`);
  if (obj.frequency != null) {
    const f = obj.frequency as string;
    parts.push(f === "MONTHLY" ? "ежемесячно" : f === "QUARTERLY" ? "ежеквартально" : "раз в год");
  }
  if (obj.date != null) parts.push(formatDateToDdMmYyyy(new Date(obj.date as string)));
  if (obj.type != null) parts.push(obj.type === "IN" ? "поступление" : "расход");
  if (obj.description != null && obj.description !== "") parts.push(String(obj.description));
  if (obj.avgCheck != null) parts.push(`ср. чек ${Number(obj.avgCheck).toLocaleString("ru")} ${currency}`);
  return parts.join(" • ") || "-";
}

function getAmountFromData(d: unknown): number | null {
  if (!d || typeof d !== "object") return null;
  const obj = d as Record<string, unknown>;
  if (obj.amount != null) return Number(obj.amount);
  if (obj.avgCheck != null) return Number(obj.avgCheck);
  return null;
}

export function HistoryModal({
  profileId,
  entityId,
  entityType,
  currency,
  onClose,
}: {
  profileId: string;
  entityId: string;
  entityType: string;
  currency: string;
  zoneGreenMin?: number;
  zoneRedMax?: number;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const hRes = await getCashFlowHistory(profileId, entityId);
      if (hRes?.history) setHistory(hRes.history);
      setLoading(false);
    }
    load();
  }, [profileId, entityId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Группируем по дате: для каждого дня берём последнее изменение (по времени)
  const byDate = new Map<string, { date: string; amount: number; createdAt: Date }>();
  const sortedHistory = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const h of sortedHistory) {
    const date = formatDateToDdMmYyyy(new Date(h.createdAt));
    let amount: number | null = null;
    if (h.action === "create" || h.action === "update") amount = getAmountFromData(h.newData);
    else if (h.action === "delete") amount = getAmountFromData(h.oldData);
    if (amount != null) {
      byDate.set(date, { date, amount, createdAt: new Date(h.createdAt) });
    }
  }
  const chartData = Array.from(byDate.values())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(({ date, amount }) => ({ date, amount }));

  const hasChartData = chartData.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Закрыть"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <h3 className="text-lg font-semibold">История изменений</h3>
          <button onClick={onClose} className="cursor-pointer rounded px-2 py-1 hover:bg-border">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        ) : (
          <>
            <div className="mt-4">
              <h4 className="font-medium">Таблица изменений</h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-2 text-left">Дата</th>
                      <th className="p-2 text-left">Действие</th>
                      <th className="p-2 text-left">Было</th>
                      <th className="p-2 text-left">Стало</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border">
                        <td className="p-2">
                          {formatDateToDdMmYyyy(new Date(h.createdAt))} {new Date(h.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-2">{ACTION_LABELS[h.action] ?? h.action}</td>
                        <td className="max-w-48 p-2 text-xs">
                          {formatDataReadable(h.oldData, currency)}
                        </td>
                        <td className="max-w-48 p-2 text-xs">
                          {formatDataReadable(h.newData, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {hasChartData && (
              <div className="mt-6">
                <h4 className="font-medium">Изменение суммы</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  График изменения поля «Сумма» для этой записи
                </p>
                <div className="mt-2 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--foreground)" fontSize={11} />
                      <YAxis stroke="var(--foreground)" fontSize={11} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0]?.payload;
                          return (
                            <div
                              className="rounded-lg border border-border px-3 py-2"
                              style={{
                                backgroundColor: "var(--surface)",
                                color: "var(--foreground)",
                              }}
                            >
                              <p className="font-medium text-foreground">Дата: {p?.date}</p>
                              <p className="text-foreground">Сумма: {(p?.amount ?? 0).toLocaleString("ru")} {currency}</p>
                            </div>
                          );
                        }}
                      />
                      <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
