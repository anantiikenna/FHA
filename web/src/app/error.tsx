"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-slate-300">!</h1>
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="text-sm text-slate-500">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono">Error: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-block rounded-lg bg-brand px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
