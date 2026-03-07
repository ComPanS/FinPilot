"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const ExpectedChartsSection = dynamic(
  () => import("./expected-charts-section").then((m) => m.ExpectedChartsSection),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
