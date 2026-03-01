// 12 предустановленных категорий расходов по ТЗ
export const DEFAULT_EXPENSE_CATEGORIES = [
  { slug: "rent", name: "Аренда" },
  { slug: "salary", name: "Зарплата" },
  { slug: "taxes", name: "Налоги" },
  { slug: "purchases", name: "Закупки" },
  { slug: "subscriptions", name: "Подписки" },
  { slug: "utilities", name: "Коммунальные услуги" },
  { slug: "marketing", name: "Маркетинг и реклама" },
  { slug: "insurance", name: "Страхование" },
  { slug: "equipment", name: "Оборудование" },
  { slug: "transport", name: "Транспорт" },
  { slug: "other", name: "Прочее" },
  { slug: "custom", name: "Своя категория" },
] as const;

export type CategorySlug = (typeof DEFAULT_EXPENSE_CATEGORIES)[number]["slug"];
