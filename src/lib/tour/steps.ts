import type { TourStep } from "./types";

/**
 * Product tour steps configuration.
 * To add a new step: append to the array with id, target, content, type, route.
 * For action steps: add requiredAction and integrate useTourAction() in the component.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "nav-cashflow",
    target: "[data-tour-id='nav-cashflow']",
    content: {
      title: "Планировщик",
      body: "Начнём с планировщика денежных потоков. Нажмите «Далее», чтобы перейти.",
    },
    type: "info",
    route: "/dashboard",
    navigateTo: "/cashflow",
  },
  {
    id: "tab-expenses",
    target: "[data-tour-id='tab-expenses']",
    content: {
      title: "Регулярные расходы и доходы",
      body: "Сначала создайте регулярные расходы и доходы. Для точного прогноза укажите «Ожидаемые данные» — суммы по месяцам.",
    },
    type: "info",
    route: "/cashflow",
  },
  {
    id: "form-add-expense",
    target: "[data-tour-id='form-add-expense']",
    content: {
      title: "Добавьте регулярный расход",
      body: "Заполните форму и нажмите «Добавить». Рекомендуется указать «Ожидаемые данные» для прогноза.",
    },
    type: "action",
    requiredAction: "add_regular_expense",
    route: "/cashflow",
    tab: "expenses",
  },
  {
    id: "form-add-income",
    target: "[data-tour-id='form-add-income']",
    content: {
      title: "Добавьте регулярный доход",
      body: "Заполните форму и нажмите «Добавить». Рекомендуется указать «Ожидаемые данные» для прогноза.",
    },
    type: "action",
    requiredAction: "add_regular_income",
    route: "/cashflow",
    tab: "incomes",
  },
  {
    id: "form-add-manual",
    target: "[data-tour-id='form-add-manual']",
    content: {
      title: "Разовые операции",
      body: "Важно: ожидаемые данные не формируются из разовых. Укажите дату, тип, сумму и нажмите «Добавить».",
    },
    type: "action",
    requiredAction: "add_manual",
    route: "/cashflow",
    tab: "manual",
  },
  {
    id: "form-add-monthly",
    target: "[data-tour-id='form-add-monthly']",
    content: {
      title: "Данные по месяцам",
      body: "Это ваши актуальные данные за прошлые месяцы, нужны чтобы рассчитать более предсказуемые данные. Выберите месяц, введите доход и расход, нажмите «Добавить».",
    },
    type: "action",
    requiredAction: "add_monthly",
    route: "/cashflow",
    tab: "months",
  },
  {
    id: "nav-fact",
    target: "[data-tour-id='nav-fact']",
    content: {
      title: "Факт",
      body: "Перейдём к вводу фактических данных. Нажмите «Далее».",
    },
    type: "info",
    route: "/cashflow",
    navigateTo: "/fact",
  },
  {
    id: "btn-actual-data",
    target: "[data-tour-id='btn-actual-data']",
    content: {
      title: "Фактические данные",
      body: "Нажмите «Фактические данные» у любой данной и введите пару значений по датам. Желательно вводить данные по дням, где это подразумевается возможным, для большей точности ожидаемых данных. К примеру: если это аренда, то не стоит вводить факт на 1 день, так как в противном случае у вас будет огромный провал в графике в этот день (в данном случае лучше брать месяц); для дохода же лучше указывать по дням. Запомните: чем больше факта — тем точнее прогноз.",
    },
    type: "action",
    requiredAction: "add_fact_data",
    route: "/fact",
  },
  {
    id: "nav-dashboard",
    target: "[data-tour-id='nav-dashboard']",
    content: {
      title: "Дашборд",
      body: "Вернёмся на дашборд. Нажмите «Далее».",
    },
    type: "info",
    route: "/fact",
    navigateTo: "/dashboard",
  },
  {
    id: "section-charts",
    target: "[data-tour-id='section-charts']",
    content: {
      title: "Дашборд и вычисления",
      body: "Здесь отображается прогноз денежного потока. Система суммирует регулярные и разовые операции по датам, учитывает фактические данные (если есть) и строит график баланса. Зелёная зона — комфортный запас, красная — риск кассового разрыва.",
    },
    type: "info",
    route: "/dashboard",
  },
  {
    id: "nav-what-if",
    target: "[data-tour-id='nav-what-if']",
    content: {
      title: "Что если",
      body: "Страница «Что если» — симуляция сценариев: рост дохода, рост расходов и т.д. Нажмите «Далее», чтобы перейти.",
    },
    type: "info",
    route: "/dashboard",
    navigateTo: "/what-if",
  },
  {
    id: "what-if-page",
    target: "[data-tour-id='what-if-page']",
    content: {
      title: "Что если",
      body: "Меняйте параметры (рост дохода %, рост расходов %, скрытие статей) и смотрите, как изменится прогноз. Можно сохранять сценарии для сравнения.",
    },
    type: "info",
    route: "/what-if",
  },
  {
    id: "nav-insights",
    target: "[data-tour-id='nav-insights']",
    content: {
      title: "ИИ-ассистент",
      body: "Перейдём к ИИ-ассистенту. Нажмите «Далее».",
    },
    type: "info",
    route: "/what-if",
    navigateTo: "/insights",
  },
  {
    id: "insights-page",
    target: "[data-tour-id='insights-page']",
    content: {
      title: "ИИ-ассистент",
      body: "ИИ анализирует ваши данные и даёт рекомендации. Задавайте вопросы о денежных потоках.",
    },
    type: "info",
    route: "/insights",
    navigateTo: "/reports",
  },
  {
    id: "reports-page",
    target: "[data-tour-id='reports-page']",
    content: {
      title: "Отчёты",
      body: "Генерируйте PDF и Excel отчёты по денежным потокам для анализа и отчётности.",
    },
    type: "info",
    route: "/reports",
  },
  {
    id: "tour-complete",
    target: "[data-tour-id='nav-dashboard']",
    content: {
      title: "Готово!",
      body: "Вы познакомились с основными разделами ФинПилота. Удачной работы с денежными потоками!",
    },
    type: "info",
    route: "/reports",
  },
];


export const TOUR_STORAGE_KEY = "finpilot_tour_completed";
export const TOUR_PENDING_STEP_KEY = "finpilot_tour_pending_step";
export const TOUR_PENDING_ROUTE_KEY = "finpilot_tour_pending_route";
export const TOUR_SWITCH_TAB_EVENT = "finpilot_tour_switch_tab";
