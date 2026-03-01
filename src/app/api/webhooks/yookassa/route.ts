import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body.event ?? body.type;
    const payment = body.object ?? body;

    if (event === "payment.succeeded" || payment.status === "succeeded") {
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
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
