"use client";

import { useState } from "react";
import { generateReportAction } from "@/app/actions/reports";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ReportGenerator({
  profileId,
  profileName,
}: {
  profileId: string;
  profileName: string;
}) {
  const today = new Date();
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 29);
  const [format, setFormat] = useState<"excel" | "pdf">("excel");
  const [startDate, setStartDate] = useState(toDateStr(today));
  const [endDate, setEndDate] = useState(toDateStr(defaultEnd));
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const from = new Date(startDate);
    const to = new Date(endDate);
    if (from > to) {
      alert("Дата начала не может быть позже даты окончания");
      return;
    }
    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 365) {
      alert("Максимальный период — 365 дней");
      return;
    }
    setLoading(true);
    try {
      const res = await generateReportAction(profileId, {
        format,
        startDate,
        endDate,
        days,
      });
      if (res?.error) {
        alert(res.error);
        return;
      }
      if (res?.url) {
        window.open(res.url, "_blank");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Формат</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "excel" | "pdf")}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
          >
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Дата начала</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Дата окончания</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Генерация..." : "Скачать отчёт"}
        </button>
      </div>
    </div>
  );
}
