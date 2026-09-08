import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-danger-light">
          <svg className="w-10 h-10 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to access this page. Contact your administrator if you believe this is an error.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand-light transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
