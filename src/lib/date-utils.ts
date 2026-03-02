/** Форматирует дату YYYY-MM-DD в dd-mm-yyyy */
export function formatDateDdMmYyyy(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return d && m && y ? `${d}-${m}-${y}` : dateStr;
}

/** Форматирует Date в dd-mm-yyyy */
export function formatDateToDdMmYyyy(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}
