"use client";

import { useCallback } from "react";

const TOUR_ACTION_EVENT = "finpilot_tour_action";

/**
 * Emit a tour action to advance the tour when user completes a required action.
 * Use after successful mutations (add expense, add income, etc.).
 */
export function emitTourAction(actionId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TOUR_ACTION_EVENT, { detail: { actionId } })
  );
}

/**
 * Hook to emit tour action from components.
 * Call after user successfully completes the required action.
 *
 * @example
 * const tourAction = useTourAction();
 * // After createExpense succeeds:
 * tourAction("add_regular_expense");
 */
export function useTourAction(): (actionId: string) => void {
  return useCallback((actionId: string) => {
    emitTourAction(actionId);
  }, []);
}
