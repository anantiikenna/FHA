export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-6 w-32 bg-slate-200 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4">
            <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
            <div className="h-8 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-slate-200 rounded" />
          <div className="h-10 w-32 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}
