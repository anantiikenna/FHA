export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-muted rounded-xl" />
              <div className="space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-7 w-10 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-5 w-28 bg-muted rounded" />
        </div>
        <div className="px-5 py-4 flex gap-3">
          <div className="h-10 w-28 bg-muted rounded-xl" />
          <div className="h-10 w-36 bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}
