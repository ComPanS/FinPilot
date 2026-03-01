"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeForecast } from "@/lib/services/forecast";
import ExcelJS from "exceljs";

export async function generateReportAction(
  profileId: string,
  options: { format: "excel" | "pdf"; days: number }
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

  if (options.format === "pdf" && user.subscription?.plan === "FREE") {
    return { error: "PDF доступен на тарифе Pro" };
  }

  const profile = user.profiles.find((p) => p.id === profileId)!;
  const forecast = await computeForecast(profileId, { days: options.days });

  if (options.format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Прогноз");
    sheet.columns = [
      { header: "Дата", key: "date", width: 12 },
      { header: "Баланс", key: "balance", width: 15 },
      { header: "Поступления", key: "inflows", width: 15 },
      { header: "Расходы", key: "outflows", width: 15 },
    ];
    forecast.forEach((d) => {
      sheet.addRow({
        date: d.date,
        balance: d.balance,
        inflows: d.inflows,
        outflows: d.outflows,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
    return { url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}` };
  }

  if (options.format === "pdf") {
    return { url: `/api/reports/download?profileId=${profileId}&days=${options.days}` };
  }

  return { error: "Неизвестный формат" };
}
