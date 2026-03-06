/**
 * Tour step configuration.
 * Extend this type when adding new step properties.
 */
export type TourStep = {
  id: string;
  /** CSS selector or [data-tour-id="value"] - element to highlight */
  target?: string;
  content: { title: string; body: string };
  /** info = show Next/Back/Close; action = wait for user to complete, no Next until action */
  type: "info" | "action";
  /** For type=action: identifier that useTourAction() must emit to advance */
  requiredAction?: string;
  /** Route where this step is shown (e.g. /dashboard, /cashflow) */
  route: string;
  /** Optional: navigate to this route when Next is clicked (for nav steps) */
  navigateTo?: string;
  /** For cashflow: switch to this tab before showing the step */
  tab?: "expenses" | "incomes" | "manual" | "months";
};

/** Action identifiers - add new ones when extending the tour */
export type TourActionId =
  | "add_regular_expense"
  | "add_regular_income"
  | "add_manual"
  | "add_monthly"
  | "add_fact_data";
