import { ChartSkeleton } from "@/components/ui/chart-skeleton";

export default function DashboardPageLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="mt-2 h-4 w-48 rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-6"
          >
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-2 h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <section className="space-y-4">
        <div className="h-6 w-32 rounded bg-muted" />
        <ChartSkeleton />
      </section>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="h-10 w-40 rounded-lg bg-muted" />
        <div className="h-10 w-32 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
