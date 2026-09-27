"use client";
import { useState, useEffect, useCallback } from "react";

interface UploadedPhoto {
  id: string;
  file_name: string;
  storage_key: string;
  created_at: string;
  /** Temporary object URL for instant preview before signing */
  previewUrl?: string;
}

function PhotoThumb({ inspectionId, photo }: { inspectionId: string; photo: UploadedPhoto }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(photo.previewUrl ?? null);
  const [loading, setLoading] = useState(!photo.previewUrl);

  useEffect(() => {
    // If we already have a local preview URL, skip the server round-trip
    if (photo.previewUrl) return;

    setLoading(true);
    fetch(`/api/v1/inspections/${inspectionId}/photos/${photo.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.signedUrl) setSignedUrl(json.data.signedUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [inspectionId, photo.id, photo.previewUrl]);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border bg-muted/30 aspect-square w-24 shrink-0">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
        </div>
      )}
      {signedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedUrl}
          alt={photo.file_name}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          onLoad={() => setLoading(false)}
        />
      )}
      {!signedUrl && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
          <svg className="w-6 h-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm0 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-[10px] text-muted-foreground text-center leading-tight break-all">{photo.file_name}</p>
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-white truncate">{photo.file_name}</p>
      </div>
    </div>
  );
}

export function PhotoUpload({ inspectionId }: { inspectionId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const fetchPhotos = useCallback(() => {
    fetch(`/api/v1/inspections/${inspectionId}/photos`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setPhotos(json.data);
      })
      .catch(() => {});
  }, [inspectionId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Only JPG/PNG files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB).");
      return;
    }

    // Create an object URL for instant preview while the upload happens
    const localPreview = URL.createObjectURL(file);

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
        URL.revokeObjectURL(localPreview);
        setError(json.error?.message ?? "Upload failed.");
        return;
      }

      // Prepend the new photo with the local preview URL for immediate display
      setPhotos((prev) => [{ ...json.data, previewUrl: localPreview }, ...prev]);
      e.target.value = "";
    } catch {
      URL.revokeObjectURL(localPreview);
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Site Photos</h3>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <label className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm text-white cursor-pointer hover:bg-brand-light transition-colors disabled:opacity-50">
        {uploading ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take / Upload Photo
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={onChange}
          disabled={uploading}
        />
      </label>

      {error && (
        <div className="flex items-center gap-2 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {photos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {photos.map((p) => (
            <PhotoThumb key={p.id} inspectionId={inspectionId} photo={p} />
          ))}
        </div>
      ) : (
        !uploading && (
          <p className="text-sm text-muted-foreground mt-3">No photos yet. Use the button above to capture or upload site photos.</p>
        )
      )}

      <p className="text-xs text-slate-400 mt-3">
        Photos are stored securely and only accessible to authorised staff.
      </p>
    </div>
  );
}
