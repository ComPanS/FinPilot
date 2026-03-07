"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const DashboardCharts = dynamic(
  () => import("./dashboard-charts").then((m) => m.DashboardCharts),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
export type { VisibleCharts } from "./dashboard-charts";
