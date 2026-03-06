"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import {
  TOUR_STEPS,
  TOUR_PENDING_STEP_KEY,
  TOUR_PENDING_ROUTE_KEY,
  TOUR_SWITCH_TAB_EVENT,
} from "@/lib/tour/steps";
import { setTourCompleted } from "@/app/actions/tour";
import type { TourStep } from "@/lib/tour/types";

const TOUR_ACTION_EVENT = "finpilot_tour_action";

type TourContextValue = {
  startTour: (fromStep?: number) => void;
  isTourActive: boolean;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue | null {
  return useContext(TourContext);
}

function tourStepToDriveStep(
  step: TourStep,
  index: number,
  total: number,
  opts: {
    onNextClick?: (driverObj: Driver) => void;
    onPrevClick?: (driverObj: Driver) => void;
    onCloseClick?: (driverObj: Driver) => void;
    isLastStep?: boolean;
  }
): DriveStep {
  const isAction = step.type === "action";
  const isLastStep = opts.isLastStep ?? index === total - 1;
  const showButtons: ("next" | "previous" | "close")[] = ["next", "previous", "close"];

  return {
    element: step.target,
    popover: {
      title: step.content.title,
      description: step.content.body,
      showButtons,
      showProgress: true,
      progressText: `${index + 1} / ${total}`,
      nextBtnText: isLastStep ? undefined : isAction ? "Пропустить" : "Далее",
      doneBtnText: isLastStep ? "Завершить" : "×",
      prevBtnText: "Назад",
      onNextClick: opts.onNextClick as never,
      onPrevClick: opts.onPrevClick as never,
      onCloseClick: opts.onCloseClick as never,
    },
  };
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);
  const currentTourRouteRef = useRef<string | null>(null);
  const prevPathnameRef = useRef<string>(pathname);
  const [isTourActive, setIsTourActive] = useState(false);

  const markCompleted = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(TOUR_PENDING_STEP_KEY);
      sessionStorage.removeItem(TOUR_PENDING_ROUTE_KEY);
      setTourCompleted();
    }
  }, []);

  const destroyDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
      currentTourRouteRef.current = null;
      setIsTourActive(false);
    }
  }, []);

  const startTour = useCallback(
    (fromStep = 0, routeOverride?: string) => {
      if (typeof window === "undefined") return;

      const route = routeOverride ?? pathname;
      const stepsForRoute = TOUR_STEPS.filter((s) => s.route === route);
      if (stepsForRoute.length === 0) {
        const targetStep = TOUR_STEPS[fromStep];
        if (targetStep?.navigateTo) {
          sessionStorage.setItem(TOUR_PENDING_STEP_KEY, String(fromStep));
          sessionStorage.setItem(TOUR_PENDING_ROUTE_KEY, targetStep.navigateTo);
          router.push(targetStep.navigateTo);
        }
        return;
      }

      // Find local start index: first step on this route with global index >= fromStep
      const idx = stepsForRoute.findIndex(
        (s) => TOUR_STEPS.findIndex((t) => t.id === s.id) >= fromStep
      );
      const startIndex = idx >= 0 ? idx : 0;

      const driveSteps: DriveStep[] = stepsForRoute.map((step, localIdx) => {
        const globalIdx = TOUR_STEPS.findIndex((s) => s.id === step.id);
        const nextStep = stepsForRoute[localIdx + 1];
        const isLastStep = globalIdx === TOUR_STEPS.length - 1;
        const prevStep = globalIdx > 0 ? TOUR_STEPS[globalIdx - 1] : null;
        const prevStepRoute = prevStep?.route;
        const needNavigateBack = prevStep && prevStepRoute && prevStepRoute !== route;

        return tourStepToDriveStep(step, globalIdx, TOUR_STEPS.length, {
          isLastStep,
          onNextClick: () => {
            const d = driverRef.current;
            if (!d) return;
            if (isLastStep) {
              markCompleted();
              destroyDriver();
              return;
            }
            if (step.navigateTo) {
              sessionStorage.setItem(TOUR_PENDING_STEP_KEY, String(globalIdx + 1));
              sessionStorage.setItem(TOUR_PENDING_ROUTE_KEY, step.navigateTo);
              d.destroy();
              driverRef.current = null;
              setIsTourActive(false);
              router.push(step.navigateTo);
            } else if (nextStep?.tab) {
              document.dispatchEvent(new CustomEvent(TOUR_SWITCH_TAB_EVENT, { detail: { tab: nextStep.tab }, bubbles: true }));
              setTimeout(() => d.moveNext(), 150);
            } else {
              d.moveNext();
            }
          },
          onPrevClick: () => {
            const d = driverRef.current;
            if (!d) return;
            if (needNavigateBack && prevStepRoute) {
              sessionStorage.setItem(TOUR_PENDING_STEP_KEY, String(globalIdx - 1));
              sessionStorage.setItem(TOUR_PENDING_ROUTE_KEY, prevStepRoute);
              d.destroy();
              driverRef.current = null;
              setIsTourActive(false);
              router.push(prevStepRoute);
            } else {
              if (prevStep?.tab) {
                const tabToSwitch = prevStep.tab;
                document.dispatchEvent(new CustomEvent(TOUR_SWITCH_TAB_EVENT, { detail: { tab: tabToSwitch }, bubbles: true }));
                setTimeout(() => {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      d.movePrevious();
                    });
                  });
                }, 150);
              } else {
                d.movePrevious();
              }
            }
          },
          onCloseClick: () => {
            markCompleted();
            destroyDriver();
          },
        });
      });

      if (driverRef.current) driverRef.current.destroy();
      const driverObj = driver({
        allowClose: false,
        showProgress: true,
        nextBtnText: "Далее",
        prevBtnText: "Назад",
        doneBtnText: "×",
        steps: driveSteps,
        onDestroyed: () => {
          driverRef.current = null;
          setIsTourActive(false);
        },
      });

      driverRef.current = driverObj;
      currentTourRouteRef.current = route;
      setIsTourActive(true);

      const startStep = stepsForRoute[startIndex];
      if (startStep?.tab) {
        document.dispatchEvent(new CustomEvent(TOUR_SWITCH_TAB_EVENT, { detail: { tab: startStep.tab }, bubbles: true }));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => driverObj.drive(startIndex), 350);
          });
        });
      } else {
        driverObj.drive(startIndex);
      }
    },
    [pathname, router, markCompleted, destroyDriver]
  );

  // Listen for tour action (user completed required action)
  useEffect(() => {
    const handler = (e: CustomEvent<{ actionId: string }>) => {
      const actionId = e.detail?.actionId;
      if (!actionId || !driverRef.current) return;

      const stepsForRoute = TOUR_STEPS.filter((s) => s.route === pathname);
      const activeIndex = driverRef.current.getActiveIndex?.() ?? 0;
      const currentStep = stepsForRoute[activeIndex];
      if (currentStep?.type === "action" && currentStep.requiredAction === actionId) {
        const nextStep = stepsForRoute[activeIndex + 1];
        if (nextStep?.tab) {
          document.dispatchEvent(new CustomEvent(TOUR_SWITCH_TAB_EVENT, { detail: { tab: nextStep.tab }, bubbles: true }));
          setTimeout(() => driverRef.current?.moveNext(), 150);
        } else {
          driverRef.current.moveNext();
        }
      }
    };

    window.addEventListener(TOUR_ACTION_EVENT, handler as EventListener);
    return () => window.removeEventListener(TOUR_ACTION_EVENT, handler as EventListener);
  }, [pathname]);

  // Detect manual navigation: user clicked a nav link instead of "Далее"
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prevPath = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prevPath === pathname) return;
    if (!driverRef.current) return;

    const route = currentTourRouteRef.current ?? prevPath;
    const stepsForRoute = TOUR_STEPS.filter((s) => s.route === route);
    const activeIndex = driverRef.current.getActiveIndex?.() ?? 0;
    const currentStep = stepsForRoute[activeIndex];
    const nextStep = stepsForRoute[activeIndex + 1];

    if (currentStep?.navigateTo === pathname || nextStep?.navigateTo === pathname) {
      const targetStep = currentStep?.navigateTo === pathname ? currentStep : nextStep;
      const globalIdx = TOUR_STEPS.findIndex((s) => s.id === targetStep.id);
      const nextGlobalIdx = targetStep.navigateTo === pathname ? globalIdx + 1 : globalIdx;
      sessionStorage.setItem(TOUR_PENDING_STEP_KEY, String(nextGlobalIdx));
      sessionStorage.setItem(TOUR_PENDING_ROUTE_KEY, pathname);
      driverRef.current.destroy();
      driverRef.current = null;
      currentTourRouteRef.current = null;
      setIsTourActive(false);
    }
  }, [pathname]);

  // Restore tour after navigation (when we navigated via navigateTo or manually)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pending = sessionStorage.getItem(TOUR_PENDING_STEP_KEY);
    const pendingRoute = sessionStorage.getItem(TOUR_PENDING_ROUTE_KEY);
    if (pending) {
      const stepIndex = parseInt(pending, 10);
      const targetRoute = pendingRoute ?? pathname;
      // Delay to let the page render (longer when navigating from another route).
      // TourLauncher checks pending and must not start from 0 while we're restoring.
      const t = setTimeout(() => {
        sessionStorage.removeItem(TOUR_PENDING_STEP_KEY);
        sessionStorage.removeItem(TOUR_PENDING_ROUTE_KEY);
        startTour(stepIndex, targetRoute);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [pathname, startTour]);

  const value: TourContextValue = {
    startTour,
    isTourActive,
  };

  return (
    <TourContext.Provider value={value}>{children}</TourContext.Provider>
  );
}
