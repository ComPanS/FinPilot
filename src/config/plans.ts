// Тарифы по ТЗ
export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Бесплатный",
    price: 0,
    priceLabel: "0 ₽",
    profiles: 1,
    aiRequestsPerDay: 5,
    forecastDays: 30,
    features: ["1 профиль", "5 ИИ-запросов в день", "30-дневный прогноз"],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 499,
    priceLabel: "499 ₽/мес",
    profiles: 3,
    aiRequestsPerDay: -1, // unlimited
    forecastDays: 90,
    features: ["3 профиля", "Безлимит ИИ", "90 дней прогноз", "Экспорт PDF"],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    price: 999,
    priceLabel: "999 ₽/мес",
    profiles: 5,
    aiRequestsPerDay: -1,
    forecastDays: 90,
    features: ["5 профилей", "Безлимит ИИ", "Приоритетная поддержка"],
  },
} as const;

export type PlanId = keyof typeof PLANS;
