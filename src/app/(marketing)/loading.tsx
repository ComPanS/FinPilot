export default function MarketingLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-surface animate-pulse" />
      <main className="max-w-7xl mx-auto px-4 py-20">
        <div className="h-12 w-3/4 max-w-2xl rounded bg-muted animate-pulse mb-4" />
        <div className="h-6 w-1/2 max-w-xl rounded bg-muted animate-pulse mb-12" />
        <div className="grid gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
