"use client";

import { useEffect } from "react";
import { getForecastDebugAction } from "@/app/actions/forecast";

export function ForecastDebug({ profileId }: { profileId: string }) {
  useEffect(() => {
    getForecastDebugAction(profileId).then((res) => {
      if (res && "error" in res) {
        console.warn("[ForecastDebug] Ошибка:", res.error);
        return;
      }
      console.group("[ForecastDebug] Прогноз расходов");
      console.log("Период:", res?.startDate, "—", res?.endDate);
      console.log("Регулярные расходы:", res?.regularExpenses);
      console.log("Разовые расходы (OUT):", res?.manualTransactions);
      console.log("dailyOutflows (первые 7 дней):", res?.dailyOutflowsSample);
      console.log("Ключи дат для результата (первые 7):", res?.resultKeysFirst7);
      console.groupEnd();
    });
  }, [profileId]);
  return null;
}
