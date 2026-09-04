import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-slate-300">404</h1>
        <p className="text-lg font-semibold">Page not found</p>
        <p className="text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/dashboard" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm text-white">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
