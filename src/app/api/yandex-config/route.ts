import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.AUTH_YANDEX_ID;
  return NextResponse.json({ clientId: clientId ?? null });
}
