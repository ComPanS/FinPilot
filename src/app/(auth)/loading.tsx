export default function AuthLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-8 w-32 rounded bg-muted animate-pulse" />
          <div className="mx-auto mt-2 h-4 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4 animate-pulse">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
