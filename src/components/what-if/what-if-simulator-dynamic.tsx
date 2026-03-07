"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const WhatIfSimulator = dynamic(
  () => import("./what-if-simulator").then((m) => m.WhatIfSimulator),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
