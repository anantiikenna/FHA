"use client";
import { useState } from "react";

interface UploadedPhoto {
  id: string;
  file_name: string;
  created_at: string;
}

export function PhotoUpload({ inspectionId }: { inspectionId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/inspections/${inspectionId}/photos`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Upload failed.");
        return;
      }

      setPhotos((prev) => [json.data, ...prev]);
    } catch {
      setError("Network error — try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-semibold mb-2">Site Photos</h3>
      <label className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm text-white cursor-pointer">
        {uploading ? "Uploading..." : "Take / Upload Photo"}
        <input type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={onChange} disabled={uploading} />
      </label>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {photos.length > 0 && (
        <div className="mt-3 space-y-1">
          {photos.map((p) => (
            <p key={p.id} className="text-xs text-emerald-700">Uploaded: {p.file_name}</p>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-2">Photos stored in private bucket; accessible only with inspection.read.</p>
    </div>
  );
}
