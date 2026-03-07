export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"
        aria-hidden
      />
    </div>
  );
}
