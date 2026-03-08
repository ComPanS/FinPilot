"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeForecast,
  computeForecastActualOnly,
} from "@/lib/services/forecast";
import { canUserExportReports, getReportExportLimit } from "@/lib/plan-utils";
import ExcelJS from "exceljs";

async function checkAndIncrementReportExport(
  userId: string,
  sub: { plan: string; trialEndsAt: Date | null; reportExportsCount: number; reportExportsMonth: string | null } | null
) {
  if (!canUserExportReports(sub)) {
    return { error: "Экспорт отчётов доступен в тарифах Standard и Pro" };
  }
  const limit = getReportExportLimit(sub?.plan ?? "FREE", sub?.trialEndsAt ?? null);
  if (limit >= 0 && sub) {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const count = sub.reportExportsMonth === monthKey ? (sub.reportExportsCount ?? 0) : 0;
    if (count >= limit) {
      return { error: `Лимит экспортов (${limit}/мес) исчерпан. Перейдите на Pro для безлимита.` };
    }
    await prisma.subscription.update({
      where: { userId },
      data: {
        reportExportsCount: sub.reportExportsMonth === monthKey ? count + 1 : 1,
        reportExportsMonth: monthKey,
      },
    });
  }
  return null;
}

export async function generateReportAction(
  profileId: string,
  options: {
    format: "excel" | "pdf";
    days: number;
    startDate: string;
    endDate: string;
  }
) {
  const session = await auth();
  if (!session?.user?.email) return { error: "Не авторизован" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return { error: "Профиль не найден" };
  }

  if (!canUserExportReports(user.subscription)) {
    return { error: "Экспорт отчётов доступен в тарифах Standard и Pro" };
  }

  const _profile = user.profiles.find((p) => p.id === profileId)!;
  const startDate = new Date(options.startDate);
  startDate.setHours(0, 0, 0, 0);

  const [forecastActual, { forecast }] = await Promise.all([
    computeForecastActualOnly(profileId, { days: options.days, startDate }),
    computeForecast(profileId, { days: options.days, startDate }),
  ]);

  const factDates = new Set(
    forecastActual.filter((d) => d.hasFactData).map((d) => d.date)
  );
  const factRows = forecastActual.filter((d) => d.hasFactData);
  const expectedRows = forecast.filter((d) => !factDates.has(d.date));

  const round = (n: number) => Math.round(n);

  if (options.format === "excel") {
    const quotaError = await checkAndIncrementReportExport(user.id, user.subscription);
    if (quotaError) return quotaError;
    const workbook = new ExcelJS.Workbook();
    const cols = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Баланс", key: "balance", width: 15 },
      { header: "Доходы", key: "inflows", width: 15 },
      { header: "Расходы", key: "outflows", width: 15 },
    ];
    const factSheet = workbook.addWorksheet("Факт");
    factSheet.columns = cols;
    factRows.forEach((d) => {
      factSheet.addRow({
        date: d.date,
        balance: round(d.balance ?? 0),
        inflows: round(d.inflows ?? 0),
        outflows: round(d.outflows ?? 0),
      });
    });
    const expectedSheet = workbook.addWorksheet("Ожидаемые");
    expectedSheet.columns = cols;
    expectedRows.forEach((d) => {
      expectedSheet.addRow({
        date: d.date,
        balance: round(d.balance),
        inflows: round(d.inflows),
        outflows: round(d.outflows),
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
    return { url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}` };
  }

  if (options.format === "pdf") {
    const params = new URLSearchParams({
      profileId,
      days: String(options.days),
      startDate: options.startDate,
      endDate: options.endDate,
    });
    return { url: `/api/reports/download?${params}` };
  }

  return { error: "Неизвестный формат" };
}
