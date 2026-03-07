"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTour } from "./TourProvider";
import { TOUR_PENDING_STEP_KEY } from "@/lib/tour/steps";

/**
 * Launches the product tour on first visit to dashboard after onboarding.
 * Place inside TourProvider, typically in dashboard layout.
 */
export function TourLauncher({ tourCompleted }: { tourCompleted: boolean }) {
  const pathname = usePathname();
  const tour = useTour();

  useEffect(() => {
    if (!tour || tourCompleted || tour.isTourActive) return;
    // Не запускать тур на страницах заполнения профиля
    if (pathname === "/onboarding" || pathname?.startsWith("/profiles/new")) return;
    if (pathname !== "/dashboard") return;

    const pending = typeof window !== "undefined" && sessionStorage.getItem(TOUR_PENDING_STEP_KEY);
    if (!pending) {
      tour.startTour(0);
    }
  }, [pathname, tour, tourCompleted]);

  return null;
}
