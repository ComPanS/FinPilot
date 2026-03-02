"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const STORAGE_KEY = "insights_chat_reset";

const QUICK_PROMPTS = [
  "Проанализируй мой прогноз и дай 3 конкретные рекомендации по устранению кассовых разрывов",
  "Что будет, если я получу оплату от клиента на 10 дней позже?",
  "Сравни мой план продаж с типичными показателями и предложи корректировку",
  "Как оптимизировать расходы, не ухудшая бизнес-процессы?",
  "Оцени риски моего денежного потока на ближайшие 3 месяца",
  "Предложи стратегию накопления резервного фонда на основе моего прогноза",
  "Какие доходы можно отложить или ускорить для сглаживания разрывов?",
  "Дай рекомендации по управлению дебиторской задолженностью",
  "Как подготовиться к сезонному спаду выручки?",
  "Проанализируй структуру расходов и предложи приоритеты при сокращении",
];

type AIRequest = { id: string; prompt: string; response: string | null; createdAt: Date };

export function InsightsChat({
  profileId,
  recentRequests,
}: {
  profileId: string;
  recentRequests: AIRequest[];
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ prompt: string; response: string }>>([]);
  const [showHistory, setShowHistory] = useState<boolean | null>(null);

  useEffect(() => {
    setShowHistory(localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  const sendPrompt = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/neuroapi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { prompt: text, response: `Ошибка: ${data.error ?? res.statusText}` }]);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setMessages((m) => [...m, { prompt: text, response: data.response }]);
      setPrompt("");
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      setMessages((m) => [...m, { prompt: text, response: `Ошибка: ${e instanceof Error ? e.message : "Неизвестная ошибка"}` }]);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  const displayMessages = showHistory === null
    ? []
    : [
        ...(showHistory ? recentRequests.slice(0, 5).map((r) => ({
          prompt: r.prompt,
          response: r.response ?? "Нет ответа",
        })) : []),
        ...messages,
      ].slice(-10);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendPrompt(p)}
            disabled={loading}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        {displayMessages.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => { setMessages([]); setShowHistory(false); localStorage.setItem(STORAGE_KEY, "1"); }}
              disabled={loading}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50 disabled:opacity-50"
            >
              Сбросить чат
            </button>
          </div>
        )}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {displayMessages.map((m, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-foreground">Вы:</p>
              <p className="text-muted-foreground">{m.prompt}</p>
              <p className="text-sm font-medium text-foreground">ИИ:</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{m.response}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt(prompt);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Введите вопрос..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Загрузка
            </span>
          ) : (
            "Спросить"
          )}
          </button>
        </form>
      </div>
    </div>
  );
}
