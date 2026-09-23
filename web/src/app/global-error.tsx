"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 24px",
                borderRadius: 16,
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              !
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest && (
              <p
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  color: "#94a3b8",
                  fontFamily: "monospace",
                  background: "#e2e8f0",
                  borderRadius: 8,
                  padding: "6px 12px",
                  margin: "0 0 24px",
                }}
              >
                {error.digest}
              </p>
            )}
            <div>
              <button
                onClick={reset}
                style={{
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
