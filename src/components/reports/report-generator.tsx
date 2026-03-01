"use client";

import { useState } from "react";
import { generateReportAction } from "@/app/actions/reports";

export function ReportGenerator({
  profileId,
  profileName,
  canExportPDF,
}: {
  profileId: string;
  profileName: string;
  canExportPDF: boolean;
}) {
  const [format, setFormat] = useState<"excel" | "pdf">("excel");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (format === "pdf" && !canExportPDF) {
      alert("Экспорт в PDF доступен на тарифе Pro и выше");
      return;
    }
    setLoading(true);
    try {
      const res = await generateReportAction(profileId, { format, days });
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
            className="mt-1 rounded border border-border px-3 py-2"
          >
            <option value="excel">Excel</option>
            <option value="pdf" disabled={!canExportPDF}>
              PDF {!canExportPDF && "(Pro)"}
            </option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Период (дней)</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1 rounded border border-border px-3 py-2"
          >
            <option value={30}>30 дней</option>
            <option value={60}>60 дней</option>
            <option value={90}>90 дней</option>
          </select>
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
