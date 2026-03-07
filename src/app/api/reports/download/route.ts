import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canUserExportReports, getReportExportLimit } from "@/lib/plan-utils";
import {
  computeForecast,
  computeForecastActualOnly,
} from "@/lib/services/forecast";
import {
  renderToBuffer,
  Font,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

Font.register({
  family: "Roboto",
  src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-cyrillic-400-normal.woff",
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Roboto" },
  title: { fontSize: 18, marginBottom: 20 },
  sectionTitle: { fontSize: 14, marginTop: 16, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: "#333", marginBottom: 4 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333",
    backgroundColor: "#f0f0f0",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  cell: {
    width: "25%",
    fontSize: 10,
    padding: 6,
    borderRightWidth: 1,
    borderColor: "#ddd",
  },
  cellLast: { width: "25%", fontSize: 10, padding: 6 },
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");
  const days = Number(searchParams.get("days")) || 90;
  const startDateParam = searchParams.get("startDate");

  if (!profileId) {
    return NextResponse.json({ error: "profileId обязателен" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profiles: true, subscription: true },
  });
  if (!user || !user.profiles.some((p) => p.id === profileId)) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 403 });
  }

  if (!canUserExportReports(user.subscription)) {
    return NextResponse.json({ error: "Экспорт отчётов доступен в тарифах Standard и Pro" }, { status: 403 });
  }

  const limit = getReportExportLimit(user.subscription?.plan ?? "FREE", user.subscription?.trialEndsAt ?? null);
  if (limit >= 0 && user.subscription) {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const count = user.subscription.reportExportsMonth === monthKey ? (user.subscription.reportExportsCount ?? 0) : 0;
    if (count >= limit) {
      return NextResponse.json({ error: "Лимит экспортов исчерпан" }, { status: 403 });
    }
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        reportExportsCount: user.subscription.reportExportsMonth === monthKey ? count + 1 : 1,
        reportExportsMonth: monthKey,
      },
    });
  }

  const profile = user.profiles.find((p) => p.id === profileId)!;
  const startDate = startDateParam
    ? (() => {
        const d = new Date(startDateParam);
        d.setHours(0, 0, 0, 0);
        return d;
      })()
    : undefined;

  const [forecastActual, { forecast }] = await Promise.all([
    computeForecastActualOnly(profileId, { days, startDate }),
    computeForecast(profileId, { days, startDate }),
  ]);

  const factDates = new Set(
    forecastActual.filter((d) => d.hasFactData).map((d) => d.date)
  );
  const factRows = forecastActual.filter((d) => d.hasFactData);
  const expectedRows = forecast.filter((d) => !factDates.has(d.date));

  const round = (n: number) => String(Math.round(n));

  const headerRow = React.createElement(
    View,
    { style: styles.headerRow },
    React.createElement(Text, { style: styles.cell }, "Дата"),
    React.createElement(Text, { style: styles.cell }, "Баланс"),
    React.createElement(Text, { style: styles.cell }, "Доходы"),
    React.createElement(Text, { style: styles.cellLast }, "Расходы")
  );

  const tableRows = (rows: Array<{ date: string; balance: number; inflows: number; outflows: number }>) =>
    rows.map((d) =>
      React.createElement(
        View,
        { key: d.date, style: styles.row },
        React.createElement(Text, { style: styles.cell }, d.date),
        React.createElement(Text, { style: styles.cell }, round(d.balance)),
        React.createElement(Text, { style: styles.cell }, round(d.inflows)),
        React.createElement(Text, { style: styles.cellLast }, round(d.outflows))
      )
    );

  const factTable = React.createElement(
    View,
    { style: styles.table },
    React.createElement(Text, { style: styles.sectionTitle }, "Факт"),
    headerRow,
    ...tableRows(
      factRows.map((d) => ({
        date: d.date,
        balance: d.balance ?? 0,
        inflows: d.inflows ?? 0,
        outflows: d.outflows ?? 0,
      }))
    )
  );

  const expectedTable = React.createElement(
    View,
    { style: styles.table },
    React.createElement(Text, { style: styles.sectionTitle }, "Ожидаемые"),
    headerRow,
    ...tableRows(expectedRows)
  );

  const Doc = () =>
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: styles.page },
        React.createElement(Text, { style: styles.title }, `Прогноз: ${profile.name}`),
        factTable,
        expectedTable
      )
    );

  const buffer = await renderToBuffer(React.createElement(Doc));
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="forecast-${profile.name}.pdf"`,
    },
  });
}
