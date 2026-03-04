/**
 * Extracts and sanitizes JSON from AI response, fixing common mistakes
 * (trailing commas, comments) that cause JSON.parse to fail.
 * Returns the raw JSON string without parsing.
 */
export function extractAndSanitize(response: string): string {
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  const firstBrace = jsonStr.indexOf("{");
  const firstBracket = jsonStr.indexOf("[");
  const start =
    firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
      ? firstBrace
      : firstBracket;
  if (start >= 0) {
    const endChar = jsonStr[start] === "{" ? "}" : "]";
    const lastIdx = jsonStr.lastIndexOf(endChar);
    if (lastIdx > start) {
      jsonStr = jsonStr.slice(start, lastIdx + 1);
    }
  }
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return jsonStr;
}

/**
 * Extracts, sanitizes and parses JSON from AI response.
 */
export function extractAndParseJson<T>(response: string): T {
  const jsonStr = extractAndSanitize(response);
  return JSON.parse(jsonStr) as T;
}

/**
 * Extracts position from JSON.parse SyntaxError message.
 * Node.js/V8 format: "Unexpected token '}' in JSON at position 575"
 */
export function getParseErrorPosition(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/position\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

type AskNeuroFn = (prompt: string, ctx: object) => Promise<string>;

/**
 * Extracts a fragment around the error position, sends to AI for fix,
 * replaces in the original string and returns the full corrected JSON.
 */
export async function fixJsonFragmentViaAI(
  jsonStr: string,
  errorPosition: number,
  askNeuro: AskNeuroFn
): Promise<string> {
  const WINDOW_BEFORE = 180;
  const WINDOW_AFTER = 220;
  const start = Math.max(0, errorPosition - WINDOW_BEFORE);
  const end = Math.min(jsonStr.length, errorPosition + WINDOW_AFTER);
  const chunk = jsonStr.slice(start, end);

  const prompt = `В этом JSON-фрагменте есть синтаксическая ошибка (trailing comma, неэкранированная кавычка и т.п.).
Верни ТОЛЬКО исправленный фрагмент, без markdown, без пояснений. Сохрани структуру и данные.

Фрагмент с ошибкой:
${chunk}`;

  const response = await askNeuro(prompt, {});
  let fixedChunk = response.trim();
  if (fixedChunk.startsWith("```")) {
    fixedChunk = fixedChunk.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  fixedChunk = fixedChunk
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  return jsonStr.slice(0, start) + fixedChunk + jsonStr.slice(end);
}
