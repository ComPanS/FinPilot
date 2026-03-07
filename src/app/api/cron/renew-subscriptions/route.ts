import { NextResponse } from "next/server";
import { runRenewSubscriptions } from "@/lib/renew-subscriptions";

/** Renew subscriptions due in the next 3 days. Expire canceled subscriptions past period end. */
async function run(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRenewSubscriptions();
    return NextResponse.json({
      ...result,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (e) {
    console.error("[cron:renew-subscriptions] Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
