export interface ForecastContext {
  forecast?: Array<{ date: string; balance: number; inflows: number; outflows: number }>;
  redZones?: Array<{ date: string; balance: number }>;
  expenses?: Array<{ name: string; amount: number; frequency: string }>;
  incomes?: Array<{ name: string; avgCheck: number }>;
}

export async function askNeuro(
  prompt: string,
  context: ForecastContext
): Promise<string> {
  const baseUrl = process.env.NEUROAPI_BASE_URL ?? "https://neuroapi.host/v1";
  const apiKey = process.env.NEUROAPI_API_KEY;
  const model = process.env.NEUROAPI_MODEL ?? "grok-4-fast-non-reasoning";

  if (!apiKey) {
    throw new Error("NEUROAPI_API_KEY is not configured");
  }

  const fullPrompt = `Ты — финансовый директор для ИП и микробизнеса. Отвечай кратко, по делу, на русском.

Данные пользователя:
${JSON.stringify(context, null, 2)}

Вопрос пользователя: ${prompt}

Дай конкретные рекомендации.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NEUROAPI error: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "Нет ответа.";
  return content;
}
