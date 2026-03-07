import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment } from "@/lib/providers/yookassa";
import { webhookLimiter, getClientIdentifier } from "@/lib/ratelimit";

/** YooKassa webhook IP whitelist (official docs: /25, /27 ranges) */
const YOOKASSA_IP_PREFIXES = [
  "77.75.156.35",
  "77.75.156.11",
  "77.75.154.",
  "77.75.153.",
  "185.71.76.",
  "185.71.77.",
  "2a02:5180:",
];

function isYooKassaIp(ip: string | null): boolean {
  if (!ip) return false;
  return YOOKASSA_IP_PREFIXES.some((p) => ip === p || ip.startsWith(p));
}

export async function POST(req: Request) {
  try {
    const ip = getClientIdentifier(req.headers);
    const { success } = await webhookLimiter.limit(ip);
    if (!success) {
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
    if (process.env.YOOKASSA_WEBHOOK_SKIP_IP_CHECK !== "true") {
      const allowedIps = process.env.YOOKASSA_WEBHOOK_ALLOWED_IPS;
      const ipAllowed = allowedIps
        ? allowedIps.split(",").map((s) => s.trim()).some((a) => ip === a || ip.startsWith(a))
        : isYooKassaIp(ip);
      if (!ipAllowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const event = body.event ?? body.type;
    const paymentPayload = body.object ?? body;
    const paymentId = paymentPayload?.id;

    if (!paymentId || (event !== "payment.succeeded" && paymentPayload?.status !== "succeeded")) {
      return NextResponse.json({ received: true });
    }

    let payment: { id?: string; status?: string; metadata?: Record<string, string> } | null = null;
    try {
      payment = await getPayment(paymentId) as { id?: string; status?: string; metadata?: Record<string, string> };
    } catch {
      return NextResponse.json({ received: true });
    }
    if (!payment || payment.status !== "succeeded") {
      return NextResponse.json({ received: true });
    }

    const metadata = payment.metadata ?? {};
    const userId = metadata.userId;
    const planId = metadata.planId;

    if (userId && planId) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: planId,
          status: "active",
          yookassaPaymentId: payment.id,
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan: planId,
          status: "active",
          yookassaPaymentId: payment.id,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
