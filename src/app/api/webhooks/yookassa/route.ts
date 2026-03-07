import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment, capturePayment } from "@/lib/providers/yookassa";
import { webhookLimiter, getClientIdentifier } from "@/lib/ratelimit";
import { BILLABLE_PLANS } from "@/config/plans";
import { formatDateMSK } from "@/lib/date-utils";

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
    if (process.env.NODE_ENV === "development") {
      console.log("[webhook:yookassa] Request received", { ip });
    }

    const { success } = await webhookLimiter.limit(ip);
    if (!success) {
      console.warn("[webhook:yookassa] Rate limit exceeded", { ip });
      return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    }
    if (process.env.YOOKASSA_WEBHOOK_SKIP_IP_CHECK !== "true") {
      const allowedIps = process.env.YOOKASSA_WEBHOOK_ALLOWED_IPS;
      const ipAllowed = allowedIps
        ? allowedIps.split(",").map((s) => s.trim()).some((a) => ip === a || ip.startsWith(a))
        : isYooKassaIp(ip);
      if (!ipAllowed) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[webhook:yookassa] IP not allowed", { ip });
        }
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const event = body.event ?? body.type;
    const paymentPayload = body.object ?? body;
    const paymentId = paymentPayload?.id;

    if (process.env.NODE_ENV === "development") {
      console.log("[webhook:yookassa] Event", { event, paymentId, status: paymentPayload?.status });
    }

    if (!paymentId) return NextResponse.json({ received: true });

    type PaymentShape = {
      id?: string;
      status?: string;
      metadata?: Record<string, string>;
      payment_method?: { id?: string };
    };
    let payment: PaymentShape | null = null;

    if (event === "payment.waiting_for_capture" && paymentPayload?.status === "waiting_for_capture") {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("[webhook:yookassa] Capturing payment", { paymentId });
        }
        payment = (await capturePayment(paymentId)) as PaymentShape;
      } catch (err) {
        console.error("[webhook:yookassa] Capture failed", { paymentId, err });
        return NextResponse.json({ received: true });
      }
    } else if (event !== "payment.succeeded" && paymentPayload?.status !== "succeeded") {
      return NextResponse.json({ received: true });
    }

    if (!payment) {
      try {
        payment = (await getPayment(paymentId)) as PaymentShape;
      } catch (err) {
        console.error("[webhook:yookassa] Failed to fetch payment", { paymentId, err });
        return NextResponse.json({ received: true });
      }
    }
    if (!payment || payment.status !== "succeeded") {
      if (process.env.NODE_ENV === "development") {
        console.log("[webhook:yookassa] Payment not succeeded, skipping", { paymentId, status: payment?.status });
      }
      return NextResponse.json({ received: true });
    }

    const metadata = payment.metadata ?? {};
    const userId = metadata.userId;
    const planId = metadata.planId;
    const billingPeriod = metadata.billingPeriod ?? "monthly";
    const trialEndsAtRaw = metadata.trialEndsAt;
    const currentPeriodEndRaw = metadata.currentPeriodEnd;

    if (process.env.NODE_ENV === "development") {
      console.log("[webhook:yookassa] Processing payment", { paymentId, userId, planId, billingPeriod });
    }

    if (userId && planId && BILLABLE_PLANS.includes(planId as (typeof BILLABLE_PLANS)[number])) {
      const now = new Date();
      const monthsToAdd = billingPeriod === "yearly" ? 12 : 1;

      let baseDate = now;
      if (trialEndsAtRaw) {
        const trialEnd = new Date(trialEndsAtRaw);
        baseDate = trialEnd > now ? trialEnd : now;
      } else if (currentPeriodEndRaw) {
        const existingEnd = new Date(currentPeriodEndRaw);
        baseDate = existingEnd > now ? existingEnd : now;
      } else {
        const existing = await prisma.subscription.findUnique({ where: { userId } });
        if (existing?.currentPeriodEnd && existing.currentPeriodEnd > now) {
          baseDate = existing.currentPeriodEnd;
        }
      }

      const periodEnd = new Date(baseDate);
      periodEnd.setMonth(periodEnd.getMonth() + monthsToAdd);

      const paymentMethodId = payment.payment_method?.id ?? undefined;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: planId,
          billingPeriod,
          status: "active",
          yookassaPaymentId: payment.id,
          yookassaPaymentMethodId: paymentMethodId,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
        },
        update: {
          plan: planId,
          billingPeriod,
          status: "active",
          trialEndsAt: null,
          yookassaPaymentId: payment.id,
          yookassaPaymentMethodId: paymentMethodId ?? undefined,
          currentPeriodEnd: periodEnd,
        },
      });
      if (process.env.NODE_ENV === "development") {
        console.log("[webhook:yookassa] Subscription updated", { userId, planId, periodEnd: formatDateMSK(periodEnd) });
      }
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[webhook:yookassa] Skipped: missing userId/planId or invalid plan", { userId, planId });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook:yookassa] Error:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
