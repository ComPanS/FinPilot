const MSK = "Europe/Moscow";

/** Форматировать дату в МСК для логов */
export function formatDateMSK(d: Date): string {
  return d.toLocaleString("ru-RU", { timeZone: MSK });
}

/** Форматировать дату в МСК для UI (короткий формат) */
export function formatDateShortMSK(d: Date): string {
  return d.toLocaleDateString("ru-RU", { timeZone: MSK });
}

/** DD.MM.YYYY в МСК (для дат из данных, строка или Date) */
export function formatDateDdMmYyyy(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { timeZone: MSK, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** DD.MM.YYYY в МСК (алиас) */
export function formatDateToDdMmYyyy(d: Date | string): string {
  return formatDateDdMmYyyy(d);
}
