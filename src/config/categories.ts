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

// Категории доходов
export const DEFAULT_INCOME_CATEGORIES = [
  { slug: "sales", name: "Продажи" },
  { slug: "services", name: "Услуги" },
  { slug: "salary", name: "Зарплата" },
  { slug: "investments", name: "Инвестиции" },
  { slug: "rent", name: "Аренда" },
  { slug: "other", name: "Прочее" },
  { slug: "custom", name: "Своя категория" },
] as const;

// Категории разовых операций (доходы и расходы)
export const DEFAULT_MANUAL_INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;
export const DEFAULT_MANUAL_EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;

export type CategorySlug = (typeof DEFAULT_EXPENSE_CATEGORIES)[number]["slug"];
