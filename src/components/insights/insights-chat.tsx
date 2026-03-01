"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

const QUICK_PROMPTS = [
  "Проанализируй мой прогноз и дай 3 конкретные рекомендации по устранению кассовых разрывов",
  "Что будет, если я получу оплату от клиента на 10 дней позже?",
  "Сравни мой план продаж с типичными показателями и предложи корректировку",
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
        return;
      }
      setMessages((m) => [...m, { prompt: text, response: data.response }]);
      setPrompt("");
    } catch (e) {
      setMessages((m) => [...m, { prompt: text, response: `Ошибка: ${e instanceof Error ? e.message : "Неизвестная ошибка"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const displayMessages = [
    ...recentRequests.slice(0, 5).map((r) => ({
      prompt: r.prompt,
      response: r.response ?? "Нет ответа",
    })),
    ...messages,
  ].slice(-10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendPrompt(p)}
            disabled={loading}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-50"
          >
            {p.slice(0, 50)}...
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
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
            {loading ? "..." : "Спросить"}
          </button>
        </form>
      </div>
    </div>
  );
}
