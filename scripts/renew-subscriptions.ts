#!/usr/bin/env tsx
/**
 * Скрипт продления подписок. Запускать через system cron:
 * 0 5 * * * cd /path/to/FinPilot && pnpm run cron:renew
 * (ежедневно в 05:00 по времени сервера)
 */
import "dotenv/config";
import { runRenewSubscriptions, getSubscriptionsWithDates } from "../src/lib/renew-subscriptions";
import { formatDateMSK } from "../src/lib/date-utils";

async function main() {
  console.log(`[cron:renew] Starting at ${formatDateMSK(new Date())} МСК...`);

  const subs = await getSubscriptionsWithDates();
  if (subs.length > 0) {
    console.log("Подписки:");
    for (const s of subs) {
      const dateStr = s.currentPeriodEnd ? formatDateMSK(s.currentPeriodEnd) : "—";
      const flags = [s.cancelAtPeriodEnd && "отмена", s.hasPaymentMethod ? "авто" : "нет карты"].filter(Boolean).join(", ");
      console.log(`  ${s.email ?? s.userId} | ${s.plan} ${s.billingPeriod ?? "monthly"} | списание: ${dateStr} ${flags ? `(${flags})` : ""}`);
    }
  } else {
    console.log("Подписки: нет платных");
  }

  const result = await runRenewSubscriptions();
  console.log("[cron:renew] Done:", JSON.stringify(result, null, 2));
  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[cron:renew] Fatal:", e);
  process.exit(1);
});
