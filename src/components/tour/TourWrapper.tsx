"use client";

import { TourProvider } from "./TourProvider";
import { TourLauncher } from "./TourLauncher";

export function TourWrapper({
  children,
  tourCompleted,
}: {
  children: React.ReactNode;
  tourCompleted: boolean;
}) {
  return (
    <TourProvider>
      <TourLauncher tourCompleted={tourCompleted} />
      {children}
    </TourProvider>
  );
}
