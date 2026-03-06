"use client";

import { useState, useEffect } from "react";
import { getDashboardFullDebugAction } from "@/app/actions/forecast";

type Props = {
  profileId: string;
};

export function DashboardCalculationLog({ profileId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fullData, setFullData] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFullData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardFullDebugAction(profileId);
      if (res && "error" in res) {
        setError(String(res.error));
        setFullData(null);
      } else {
        setFullData(res as object);
      }
    } catch (e) {
      setError(String(e));
      setFullData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && fullData === null && !loading) {
      loadFullData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, profileId]);

  const formatJson = (obj: unknown) => JSON.stringify(obj, null, 2);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-sm font-medium text-foreground">
          Все данные с сервера (полный debug)
        </h3>
        <span className="text-muted-foreground">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 font-mono text-xs">
          {loading && (
            <p className="text-muted-foreground">Загрузка всех данных с сервера…</p>
          )}
          {error && (
            <p className="text-danger">Ошибка: {error}</p>
          )}
          {fullData && !loading && (
            <div className="space-y-4">
              {"debugState" in fullData && fullData.debugState && (
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-foreground">
                    Диагностика: monthlyByMonth, источник, первые 3 дня
                  </h4>
                  <pre className="max-h-48 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(fullData.debugState, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground">
                  Полный сырой JSON: inputParams, profile, forecastRes, forecastFactOnly, expectedForecastRes, actualEntries, expectedEntries, manualTransactions, forecastDebug, debugState.
                </p>
                <button
                  type="button"
                  onClick={loadFullData}
                  disabled={loading}
                  className="shrink-0 rounded bg-muted px-2 py-1 text-xs hover:bg-muted/80 disabled:opacity-50"
                >
                  Обновить
                </button>
              </div>
              <pre className="max-h-[70vh] overflow-auto rounded bg-muted/50 p-2 text-muted-foreground whitespace-pre-wrap break-all">
                {formatJson(fullData)}
              </pre>
            </div>
          )}
          {expanded && !fullData && !loading && !error && (
            <button
              type="button"
              onClick={loadFullData}
              className="rounded bg-primary px-3 py-1 text-white hover:bg-primary/90"
            >
              Загрузить все данные
            </button>
          )}
        </div>
      )}
    </div>
  );
}
