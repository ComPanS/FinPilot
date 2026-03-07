"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const ForecastChart = dynamic(
  () => import("./forecast-chart").then((m) => m.ForecastChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
