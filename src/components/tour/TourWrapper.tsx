"use client";

import dynamic from "next/dynamic";

const TourProviderWithLauncher = dynamic(
  () =>
    import("./TourProviderWithLauncher").then((m) => m.TourProviderWithLauncher),
  { ssr: false }
);

export function TourWrapper({
  children,
  tourCompleted,
}: {
  children: React.ReactNode;
  tourCompleted: boolean;
}) {
  if (tourCompleted) {
    return <>{children}</>;
  }
  return (
    <TourProviderWithLauncher tourCompleted={tourCompleted}>
      {children}
    </TourProviderWithLauncher>
  );
}
