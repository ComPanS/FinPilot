"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { askNeuro } from "@/lib/neuroapi";
import {
  createExpense,
  createIncome,
  createManualTransaction,
  createOrUpdateMonthlyDataAction,
} from "./cashflow";
import {
  extractAndSanitize,
  extractAndParseJson,
  getParseErrorPosition,
  fixJsonFragmentViaAI,
} from "@/lib/parse-ai-json";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 200;
const CHUNK_SIZE = 10;

/** xlsx: ZIP (PK), xls: OLE Compound Document */
const EXCEL_MAGIC = {
  xlsx: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  xlsxAlt: Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  xls: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
};

function isValidExcelBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const head = buffer.subarray(0, 4);
  return (
    head.equals(EXCEL_MAGIC.xlsx) ||
    head.equals(EXCEL_MAGIC.xlsxAlt) ||
    head.equals(EXCEL_MAGIC.xls)
  );
}

export type ParsedExcelItem = {
  type: "expense" | "income";
  name: string;
  amount: number;
  frequency: string;
  taxes?: number;
  categorySlug?: string;
};

export type ParsedExcelMonthly = {
  month: string;
  income: number;
  expense: number;
};

export type ParsedExcelManual = {
  date: string;
  amount: number;
  type: "IN" | "OUT";
  description?: string;
};

export type ParsedExcelResult = {
  items: ParsedExcelItem[];
  monthlyData: ParsedExcelMonthly[];
  manual: ParsedExcelManual[];
};

async function parseExcelToRows(base64: string): Promise<string[][]> {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("Файл слишком большой (максимум 5 МБ)");
  }
  if (!isValidExcelBuffer(buffer)) {
    throw new Error("Недопустимый формат файла. Загрузите Excel (.xlsx или .xls)");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("В файле нет листов");
  }

  const rows: string[][] = [];
  let rowCount = 0;

  worksheet.eachRow((row, _rowNumber) => {
    if (rowCount >= MAX_ROWS) return;
    const values = (row.values as (string | number | Date | undefined)[]) ?? [];
    const rowStr = values.slice(1).map((v) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v ?? "").trim();
    });
    rows.push(rowStr);
    rowCount++;
  });

  return rows;
}

type ParsedShape = {
  items?: Array<{ type?: string; name?: string; amount?: number; frequency?: string; taxes?: number; categorySlug?: string }>;
  monthlyData?: Array<{ month?: string; income?: number; expense?: number }>;
  manual?: Array<{ date?: string; amount?: number; type?: string; description?: string }>;
};

async function parseResponseWithRetry<T>(
  response: string,
  parse: (s: string) => T
): Promise<
  | { success: true; data: T }
  | { success: false; error: string; debugJson?: string }
> {
  const jsonStr = extractAndSanitize(response);
  try {
    const data = parse(jsonStr) as T;
    return { success: true, data };
  } catch (e) {
    const pos = getParseErrorPosition(e);
    if (pos !== null) {
      try {
        const fixed = await fixJsonFragmentViaAI(jsonStr, pos, askNeuro);
        const data = parse(fixed) as T;
        return { success: true, data };
      } catch (e2) {
        return {
          success: false,
          error: "Не удалось исправить JSON. Попробуйте загрузить файл снова." as const,
          debugJson: jsonStr,
        };
      }
    }
    const err = e instanceof SyntaxError ? e : new Error(String(e));
    const msg = err.message.includes("position")
      ? `ИИ вернул некорректный JSON (${err.message}). Попробуйте загрузить файл снова или ввести данные вручную.`
      : err.message;
    return { success: false, error: msg, debugJson: jsonStr };
  }
}

/**
 * Parse Excel file and return structured data for onboarding (no DB write).
 * Accepts base64-encoded file content.
 */
export async function parseExcelWithAIAction(base64: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  try {
    const rows = await parseExcelToRows(base64);
    if (rows.length === 0) return { error: "Файл пуст или не содержит данных" };

    const currentYear = new Date().getFullYear();
    const promptBase = `Проанализируй сырые строки из Excel-таблицы. Первая строка может быть заголовками. Определи колонки по смыслу: название, сумма, тип (расход/доход), дата, месяц, частота.

Верни ТОЛЬКО один JSON объект без markdown и пояснений:
{
  "items": [{"type":"expense"|"income","name":"строка","amount":число,"frequency":"MONTHLY"|"QUARTERLY"|"YEARLY"|"WEEKLY"|"DAILY","taxes":число,"categorySlug":"rent"|"salary"|"taxes"|"purchases"|"subscriptions"|"utilities"|"marketing"|"insurance"|"equipment"|"transport"|"other"|"sales"|"services"|"investments"}],
  "monthlyData": [{"month":"YYYY-MM","income":число,"expense":число}],
  "manual": [{"date":"YYYY-MM-DD","amount":число,"type":"IN"|"OUT","description":"строка"}]
}

Правила:
- items: только регулярные расходы и доходы (повторяющиеся, с частотой). name, amount, frequency обязательны. categorySlug для расхода: rent, salary, taxes, purchases, subscriptions, utilities, marketing, insurance, equipment, transport, other. Для дохода: sales, services, salary, investments, rent, other.
- monthlyData: итоги по месяцам (month в YYYY-MM, год ${currentYear} если не указан)
- manual: разовые операции (однократные расходы/доходы с конкретной датой). date в YYYY-MM-DD, amount, type IN или OUT, description по желанию. Если видишь разовые расходы или доходы (однократные, с датой) — обязательно добавляй в manual, а не в items.
- Если колонка неоднозначна — определи по контексту (числа в колонке "доход" → income)
- Пропускай пустые строки и строки без сумм`;

    const chunks: string[][][] =
      rows.length <= CHUNK_SIZE
        ? [rows]
        : Array.from({ length: Math.ceil(rows.length / CHUNK_SIZE) }, (_, i) =>
            rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          );

    const allItems: ParsedExcelItem[] = [];
    const monthlyByMonth = new Map<string, { income: number; expense: number }>();
    const allManual: ParsedExcelManual[] = [];

    for (const chunk of chunks) {
      const chunkPrompt = chunks.length > 1
        ? `${promptBase}\n\nОбрабатывай только эти строки. Верни JSON с items, monthlyData, manual (массивы могут быть пустыми).\n\nСырые строки: ${JSON.stringify(chunk)}`
        : `${promptBase}\n\nСырые строки (массив массивов): ${JSON.stringify(chunk)}`;

      const response = await askNeuro(chunkPrompt, {});
      const result = await parseResponseWithRetry<ParsedShape>(response, (s) =>
        JSON.parse(s) as ParsedShape
      );

      if (!result.success)
        return { error: result.error, debugJson: result.debugJson };

      const parsed = result.data;

      for (const it of parsed.items ?? []) {
        if (
          (it.type === "expense" || it.type === "income") &&
          it.name &&
          typeof it.amount === "number" &&
          it.amount > 0
        ) {
          allItems.push({
            type: it.type,
            name: String(it.name),
            amount: it.amount,
            categorySlug: it.categorySlug,
            frequency: it.frequency ?? "MONTHLY",
            taxes: it.taxes ?? 0,
          });
        }
      }

      for (const m of parsed.monthlyData ?? []) {
        const month = String(m.month ?? "").trim();
        if (!/^\d{4}-\d{2}$/.test(month)) continue;
        const cur = monthlyByMonth.get(month) ?? { income: 0, expense: 0 };
        cur.income += Math.max(0, Number(m.income) || 0);
        cur.expense += Math.max(0, Number(m.expense) || 0);
        monthlyByMonth.set(month, cur);
      }

      for (const m of parsed.manual ?? []) {
        if (
          m.date &&
          typeof m.amount === "number" &&
          m.amount > 0 &&
          (m.type === "IN" || m.type === "OUT")
        ) {
          allManual.push({
            date: m.date,
            amount: m.amount,
            type: m.type,
            description: m.description,
          });
        }
      }
    }

    const monthlyData: ParsedExcelMonthly[] = Array.from(monthlyByMonth.entries())
      .map(([month, { income, expense }]) => ({ month, income, expense }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyDataFiltered = monthlyData.filter((m) => m.month < currentMonthKey);

    return {
      items: allItems,
      monthlyData: monthlyDataFiltered,
      manual: allManual,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Ошибка при обработке файла",
    };
  }
}

/**
 * Parse Excel and import into profile (create expenses, incomes, monthly data, manual transactions).
 */
export async function parseExcelAndImportAction(profileId: string, base64: string) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  const result = await parseExcelWithAIAction(base64);
  if (result.error) return { error: result.error, debugJson: result.debugJson };
  const hasData =
    (result.items?.length ?? 0) > 0 ||
    (result.monthlyData?.length ?? 0) > 0 ||
    (result.manual?.length ?? 0) > 0;
  if (!hasData) return { error: "Нет данных для импорта" };

  const expenseCategories = await prisma.expenseCategory.findMany({
    where: { OR: [{ isSystem: true }, { userId: user.id }] },
  });
  const incomeCategories = await prisma.incomeCategory.findMany({
    where: { OR: [{ isSystem: true }, { userId: user.id }] },
  });

  const catExpenseOther =
    expenseCategories.find((c) => c.slug === "other")?.id ?? expenseCategories[0]?.id;
  const catIncomeOther =
    incomeCategories.find((c) => c.slug === "other")?.id ?? incomeCategories[0]?.id;
  if (!catExpenseOther || !catIncomeOther) {
    return { error: "Нет категорий" };
  }

  const errors: string[] = [];
  let created = 0;

  for (const it of result.items ?? []) {
    try {
      if (it.type === "expense") {
        const slug = it.categorySlug ?? "other";
        const catId =
          expenseCategories.find((c) => c.slug === slug)?.id ?? catExpenseOther;
        const res = await createExpense({
          profileId,
          name: it.name,
          amount: it.amount,
          frequency: it.frequency,
          categoryId: catId,
        });
        if (res?.error) errors.push(`${it.name}: ${res.error}`);
        else created++;
      } else {
        const slug = it.categorySlug ?? "other";
        const catId =
          incomeCategories.find((c) => c.slug === slug)?.id ?? catIncomeOther;
        const res = await createIncome({
          profileId,
          name: it.name,
          amount: it.amount,
          categoryId: catId,
          frequency: it.frequency,
          taxes: it.taxes,
        });
        if (res?.error) errors.push(`${it.name}: ${res.error}`);
        else created++;
      }
    } catch (e) {
      errors.push(`${it.name}: ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  }

  for (const m of result.monthlyData ?? []) {
    try {
      const res = await createOrUpdateMonthlyDataAction(
        profileId,
        m.month,
        m.income,
        m.expense
      );
      if (res?.error) errors.push(`${m.month}: ${res.error}`);
      else created++;
    } catch (e) {
      errors.push(`${m.month}: ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  }

  for (const m of result.manual ?? []) {
    try {
      const res = await createManualTransaction({
        profileId,
        date: new Date(m.date),
        type: m.type,
        amount: m.amount,
        description: m.description,
        expenseCategoryId: m.type === "OUT" ? catExpenseOther : undefined,
        incomeCategoryId: m.type === "IN" ? catIncomeOther : undefined,
      });
      if (res?.error) errors.push(`${m.date}: ${res.error}`);
      else created++;
    } catch (e) {
      errors.push(`${m.date}: ${e instanceof Error ? e.message : "Ошибка"}`);
    }
  }

  if (created === 0 && errors.length > 0) {
    return { error: errors.join(". ") };
  }
  return {
    success: true,
    created,
    partialErrors: errors.length > 0 ? errors : undefined,
  };
}
