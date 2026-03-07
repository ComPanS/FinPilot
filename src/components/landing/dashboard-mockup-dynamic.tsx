"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export const DashboardMockup = dynamic(
  () => import("./dashboard-mockup").then((m) => m.DashboardMockup),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
