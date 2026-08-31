"use client";
import { useState } from "react";

export function PhotoUpload({ inspectionId }: { inspectionId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // SECURITY.md:24 — validate type/size client-side; server validates again
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Only JPG/PNG allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB).");
      return;
    }
    setUploading(true);
    setError(null);
    // TODO: POST /api/v1/inspections/{inspectionId}/photos (API.md:30)
    // FormData → server validates → storage private bucket → inspection_photos row
    setTimeout(() => setUploading(false), 600);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-semibold mb-2">Site Photos</h3>
      <label className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm text-white cursor-pointer">
        {uploading ? "Uploading..." : "Take / Upload Photo"}
        <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={onChange} disabled={uploading} />
      </label>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-slate-500 mt-2">Photos stored in private bucket; accessible only with inspection.read (SECURITY.md:28).</p>
    </div>
  );
}
