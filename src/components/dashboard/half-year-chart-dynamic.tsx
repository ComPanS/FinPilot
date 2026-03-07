"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const HalfYearChart = dynamic(
  () => import("./half-year-chart").then((m) => m.HalfYearChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
