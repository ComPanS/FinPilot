import { NextResponse } from "next/server";

/** Health check endpoint for Docker/load balancer. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
