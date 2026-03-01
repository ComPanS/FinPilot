import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeForecast } from "@/lib/services/forecast";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 20 },
  row: { flexDirection: "row", marginBottom: 4 },
  cell: { width: "25%", fontSize: 10 },
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");
  const days = Number(searchParams.get("days")) || 90;

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
  if (user.subscription?.plan === "FREE") {
    return NextResponse.json({ error: "PDF доступен на Pro" }, { status: 403 });
  }

  const profile = user.profiles.find((p) => p.id === profileId)!;
  const forecast = await computeForecast(profileId, { days });

  const Doc = () =>
    React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: styles.page },
        React.createElement(Text, { style: styles.title }, `Прогноз: ${profile.name}`),
        ...forecast.slice(0, 90).map((d) =>
          React.createElement(
            View,
            { key: d.date, style: styles.row },
            React.createElement(Text, { style: styles.cell }, d.date),
            React.createElement(Text, { style: styles.cell }, d.balance.toFixed(0)),
            React.createElement(Text, { style: styles.cell }, d.inflows.toFixed(0)),
            React.createElement(Text, { style: styles.cell }, d.outflows.toFixed(0))
          )
        )
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
