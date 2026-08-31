export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-brand">FHA</h1>
        <p className="text-sm text-slate-500 mb-6">Development & Property System — Sign in</p>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email / Staff ID</label>
            <input className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="engineer@fha.gov.ng" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input type="password" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent">
            Sign in
          </button>
          <p className="text-xs text-slate-500">Demo accounts: engineer@demo.fha / Admin@demo.fha (see seed)</p>
        </form>
      </div>
    </div>
  );
}
