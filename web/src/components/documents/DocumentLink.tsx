"use client";

import { useState } from "react";

// "View" button that opens a document in a new tab via a short-lived signed
// URL (documents are never exposed as permanent public links — AGENTS §12).
export default function DocumentLink({ documentId, label = "View" }: { documentId: string; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/documents/${encodeURIComponent(documentId)}/url`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json.data?.signedUrl) {
        window.alert(json?.error?.message ?? "Could not open this document.");
        return;
      }
      window.open(json.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.alert("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void open()}
      disabled={busy}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors"
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
