// Единый источник правды для тарифов ffinplaner (PRICES.md)
// Все проверки доступа и отображение на фронте берут данные отсюда.

export type PlanLimits = {
  profiles: number;
  forecastDays: number;
  whatIfScenarios: number;
  reportExportsPerMonth: number; // -1 = unlimited
  aiRequestsPerDay: number; // 0 = no chat, -1 = unlimited (fair-use)
  autoInsightsCount: number; // на дашборде
};

export type PlanFeatures = {
  canExportReports: boolean;
  canUseAIChat: boolean;
  hasAutoInsights: boolean;
  hasPrioritySupport: boolean;
  hasExtendedWhatIf: boolean;
};

export type PlanConfig = {
  id: string;
  name: string;
  price: number;
  priceYear: number;
  priceLabel: string;
  priceYearLabel: string;
  yearlySavingsPercent: number;
  limits: PlanLimits;
  features: PlanFeatures;
  featuresList: string[];
  targetAudience: string;
  trialDays?: number;
};

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Бесплатный",
    price: 0,
    priceYear: 0,
    priceLabel: "0 ₽",
    priceYearLabel: "0 ₽",
    yearlySavingsPercent: 0,
    limits: {
      profiles: 1,
      forecastDays: 30,
      whatIfScenarios: 1,
      reportExportsPerMonth: 0,
      aiRequestsPerDay: 0,
      autoInsightsCount: 0,
    },
    features: {
      canExportReports: false,
      canUseAIChat: false,
      hasAutoInsights: false,
      hasPrioritySupport: false,
      hasExtendedWhatIf: false,
    },
    featuresList: [
      "1 профиль",
      "30 дней прогноз",
      "Импорт PDF и Excel",
      "Режим «Что если»: 1 сценарий, 2 месяца",
      "Отчёты: просмотр в UI",
    ],
    targetAudience: "Одиночные ИП, пробуют продукт",
  },
  STANDARD: {
    id: "STANDARD",
    name: "Standard",
    price: 490,
    priceYear: 4900,
    priceLabel: "490 ₽/мес",
    priceYearLabel: "4 900 ₽/год",
    yearlySavingsPercent: 17,
    limits: {
      profiles: 3,
      forecastDays: 60,
      whatIfScenarios: 3,
      reportExportsPerMonth: 15,
      aiRequestsPerDay: 0,
      autoInsightsCount: 5,
    },
    features: {
      canExportReports: true,
      canUseAIChat: false,
      hasAutoInsights: true,
      hasPrioritySupport: false,
      hasExtendedWhatIf: false,
    },
    featuresList: [
      "До 3 профилей",
      "60 дней прогноз",
      "Экспорт PDF и Excel (15/мес)",
      "Режим «Что если»: до 3 сценариев",
      "История операций: 12 месяцев",
      "5 автоматических рекомендаций на дашборде",
    ],
    targetAudience: "ИП с 1–3 бизнес-юнитами, микробизнес",
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 990,
    priceYear: 9900,
    priceLabel: "990 ₽/мес",
    priceYearLabel: "9 900 ₽/год",
    yearlySavingsPercent: 17,
    limits: {
      profiles: 5,
      forecastDays: 90,
      whatIfScenarios: 50,
      reportExportsPerMonth: -1,
      aiRequestsPerDay: -1,
      autoInsightsCount: -1,
    },
    features: {
      canExportReports: true,
      canUseAIChat: true,
      hasAutoInsights: true,
      hasPrioritySupport: true,
      hasExtendedWhatIf: true,
    },
    featuresList: [
      "До 5 профилей",
      "90 дней прогноз",
      "ИИ-ассистент безлимит",
      "Экспорт отчётов безлимит",
      "До 50 сценариев «Что если»",
      "История операций без ограничений",
      "Приоритетная поддержка (ответ до 12 ч)",
    ],
    targetAudience: "Собственники с несколькими юнитами, консультанты",
  },
  TRIAL: {
    id: "TRIAL",
    name: "Пробный период",
    price: 0,
    priceYear: 0,
    priceLabel: "14 дней бесплатно",
    priceYearLabel: "—",
    yearlySavingsPercent: 0,
    trialDays: 14,
    limits: {
      profiles: 5,
      forecastDays: 90,
      whatIfScenarios: 50,
      reportExportsPerMonth: -1,
      aiRequestsPerDay: -1,
      autoInsightsCount: -1,
    },
    features: {
      canExportReports: true,
      canUseAIChat: true,
      hasAutoInsights: true,
      hasPrioritySupport: false,
      hasExtendedWhatIf: true,
    },
    featuresList: [
      "Полный функционал Pro на 14 дней",
      "90 дней прогноз",
      "ИИ-ассистент",
      "5 профилей",
      "Экспорт безлимит",
    ],
    targetAudience: "Пробный период",
  },
} as const;

export const ADDONS = {
  extraProfile: {
    id: "extraProfile",
    price: 149,
    label: "+149 ₽/мес",
    description: "Дополнительный профиль",
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** Планы, доступные для покупки (не FREE, не TRIAL) */
export const BILLABLE_PLANS: PlanId[] = ["STANDARD", "PRO"];

/** Планы, считающиеся «Pro-уровнем» (полный доступ) */
export const PRO_LEVEL_PLANS: PlanId[] = ["PRO", "TRIAL"];

/** Fair-use лимит ИИ для Pro (запросов в сутки, soft cap) */
export const AI_FAIR_USE_DAILY_CAP = 5000;

/** Маппинг legacy планов (BUSINESS → PRO) */
const LEGACY_PLAN_MAP: Record<string, string> = {
  BUSINESS: "PRO",
};

export function getPlanConfig(
  planId: string | null | undefined,
): PlanConfig | null {
  if (!planId) return null;
  const mapped = LEGACY_PLAN_MAP[planId] ?? planId;
  const plan = PLANS[mapped];
  return plan ?? null;
}

export function getPlanLimits(planId: string | null | undefined): PlanLimits {
  const plan = getPlanConfig(planId);
  return plan?.limits ?? PLANS.FREE.limits;
}

export function canAccessFeature(
  planId: string | null | undefined,
  feature: keyof PlanFeatures,
): boolean {
  const plan = getPlanConfig(planId);
  return plan?.features[feature] ?? false;
}

/** Эффективный план: TRIAL с активным периодом = Pro */
export function getEffectivePlan(
  planId: string | null | undefined,
  trialEndsAt: Date | null | undefined,
): string {
  if (planId === "TRIAL" && trialEndsAt && new Date(trialEndsAt) > new Date()) {
    return "TRIAL";
  }
  if (
    planId === "TRIAL" &&
    (!trialEndsAt || new Date(trialEndsAt) <= new Date())
  ) {
    return "FREE";
  }
  return planId ?? "FREE";
}

/** Лимиты с учётом триала (TRIAL = Pro) */
export function getEffectiveLimits(
  planId: string | null | undefined,
  trialEndsAt: Date | null | undefined,
): PlanLimits {
  const effective = getEffectivePlan(planId, trialEndsAt);
  return getPlanLimits(effective === "TRIAL" ? "PRO" : effective);
}
