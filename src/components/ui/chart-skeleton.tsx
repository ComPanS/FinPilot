export function ChartSkeleton() {
  return (
    <div className="h-[300px] w-full animate-pulse rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 h-4 w-1/3 rounded bg-muted" />
      <div className="h-[240px] w-full">
        <svg
          viewBox="0 0 400 200"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 120 Q 50 100, 100 80 T 200 60 T 300 90 T 400 40 L 400 200 L 0 200 Z"
            fill="currentColor"
            className="text-muted opacity-40"
          />
          <path
            d="M 0 120 Q 50 100, 100 80 T 200 60 T 300 90 T 400 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted opacity-60"
          />
        </svg>
      </div>
    </div>
  );
}
