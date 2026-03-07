#!/usr/bin/env tsx
/**
 * Локальный тест: запуск продления подписок каждую минуту.
 * Ctrl+C для остановки.
 */
import "dotenv/config";
import { runRenewSubscriptions, getSubscriptionsWithDates } from "../src/lib/renew-subscriptions";
import { formatDateMSK } from "../src/lib/date-utils";

const INTERVAL_MS = 60 * 1000; // 1 минута

async function tick() {
  const now = formatDateMSK(new Date());
  console.log(`[${now} МСК] Running renew...`);

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
  console.log("Result:", JSON.stringify(result));
}

async function main() {
  console.log(`Renew subscriptions every ${INTERVAL_MS / 1000}s. Ctrl+C to stop.`);
  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
