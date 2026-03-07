"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const FactChart = dynamic(
  () => import("./fact-chart").then((m) => m.FactChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
