"use client";

import dynamic from "next/dynamic";

export const ExpectedPeriodsModal = dynamic(
  () => import("./expected-periods-modal").then((m) => m.ExpectedPeriodsModal),
  { ssr: false }
);
