"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { PhotoThumb, type UploadedPhoto } from "@/components/inspection/PhotoThumb";
import { PhotoLightbox } from "@/components/photos/PhotoLightbox";
import { validateEvidenceFile, photosRemaining, MAX_PHOTOS_PER_AREA } from "@/lib/photo-validate";

interface FreshGps {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

function currentPosition(timeoutMs = 4000): Promise<FreshGps | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          capturedAt: new Date(pos.timestamp).toISOString(),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs }
    );
  });
}

/**
 * Evidence photos for a map area. At least one photo is required before a
 * property outcome can be recorded (owner decision). Deleting stops once an
 * outcome is recorded; optional additions are still allowed until the
 * per-area cap.
 */
export function AreaPhotoCapture({
  areaId,
  onCountChange,
}: {
  areaId: string;
  onCountChange?: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [locked, setLocked] = useState(false);
  const [limit, setLimit] = useState(MAX_PHOTOS_PER_AREA);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const endpoint = `/api/v1/map-areas/${areaId}/photos`;

  const signForViewer = useCallback(
    async (photoId: string) => {
      const res = await fetch(`${endpoint}/${photoId}`);
      const json = await res.json();
      if (!json.success || !json.data?.signedUrl) throw new Error("sign failed");
      return json.data.signedUrl as string;
    },
    [endpoint]
  );

  // Keep the latest callback in a ref so fetchPhotos is stable — otherwise
  // the parent's inline arrow would re-trigger the fetch effect on every
  // render, racing the optimistic upload prepend and duplicating thumbs.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const fetchPhotos = useCallback(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setPhotos(json.data);
          setLocked(Boolean(json.meta?.locked));
          setLimit(
            typeof json.meta?.max === "number" ? json.meta.max : MAX_PHOTOS_PER_AREA
          );
          onCountChangeRef.current?.(json.data.length);
        }
      })
      .catch(() => {});
  }, [endpoint]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  /** Handles one file (camera) or a multi-select batch (file picker). */
  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setStatus(null);

    // Validate the whole batch up front so the user sees every problem at once.
    const rejected: string[] = [];
    const valid: File[] = [];
    for (const file of files) {
      const reason = validateEvidenceFile(file);
      if (reason) rejected.push(`${file.name}: ${reason}`);
      else valid.push(file);
    }

    if (valid.length === 0) {
      setStatus({ tone: "error", message: rejected.join(" · ") });
      return;
    }

    // Trim the batch to the area's remaining slots (server enforces too).
    const remaining = photosRemaining(photos.length, limit);
    let overLimit = 0;
    if (valid.length > remaining) {
      overLimit = valid.length - remaining;
      valid.length = remaining;
    }
    if (valid.length === 0) {
      setStatus({
        tone: "error",
        message: `Maximum of ${limit} photos reached for this property.`,
      });
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: valid.length });

    // One GPS fix for the whole batch — all photos are being taken now.
    const fresh = await currentPosition();
    let added = 0;
    let lastFailure: string | null = null;

    for (const file of valid) {
      const localPreview = URL.createObjectURL(file);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "capturedAt",
          fresh?.capturedAt ?? new Date(file.lastModified || Date.now()).toISOString()
        );
        if (fresh) {
          formData.append("latitude", String(fresh.latitude));
          formData.append("longitude", String(fresh.longitude));
        }

        const res = await fetch(endpoint, { method: "POST", body: formData });
        const json = await res.json();
        if (!json.success) {
          URL.revokeObjectURL(localPreview);
          lastFailure = json.error?.message ?? "Upload failed.";
          continue;
        }

        added += 1;
        setPhotos((prev) => {
          // Dedupe by id — a concurrent list fetch may have already delivered
          // this photo; merging blindly would render duplicate thumbs.
          const next = prev.some((p) => p.id === json.data.id)
            ? prev.map((p) => (p.id === json.data.id ? { ...json.data, previewUrl: localPreview } : p))
            : [{ ...json.data, previewUrl: localPreview }, ...prev];
          onCountChangeRef.current?.(next.length);
          return next;
        });
      } catch {
        URL.revokeObjectURL(localPreview);
        lastFailure = "Network error — please try again.";
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }

    setProgress(null);
    setUploading(false);

    const parts: string[] = [];
    if (added > 0) parts.push(added === 1 ? "Added 1 photo." : `Added ${added} photos.`);
    const failed = valid.length - added;
    if (failed > 0) {
      parts.push(
        failed === 1
          ? (lastFailure ?? "1 photo could not be uploaded.")
          : `${failed} photos could not be uploaded${lastFailure ? ` (${lastFailure})` : "."}`
      );
    }
    if (rejected.length > 0) parts.push(rejected.join(" · "));
    if (overLimit > 0) {
      parts.push(
        `Skipped ${overLimit} — this property already has the maximum of ${limit} photos.`
      );
    }
    if (parts.length > 0) {
      setStatus({
        tone: failed > 0 || rejected.length > 0 || overLimit > 0 ? "error" : "success",
        message: parts.join(" "),
      });
    }
  }

  async function onDelete(id: string) {
    setStatus(null);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setStatus({ tone: "error", message: json.error?.message ?? "Could not delete the photo." });
        return;
      }
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        onCountChangeRef.current?.(next.length);
        return next;
      });
    } catch {
      setStatus({ tone: "error", message: "Network error — please try again." });
    }
  }

  const remaining = photosRemaining(photos.length, limit);

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Property Photos</h3>
        <span className="text-xs text-muted-foreground">
          {photos.length} of {limit} photos
          {locked && " · outcome recorded"}
        </span>
      </div>

      {remaining === 0 && (
        <p className="text-xs text-muted-foreground mb-2 rounded-lg bg-muted border border-border px-3 py-2">
          Maximum of {limit} photos reached for this property.
        </p>
      )}

      {remaining > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs text-white transition-colors ${
                uploading ? "opacity-70 pointer-events-none" : "cursor-pointer hover:bg-brand-light"
              }`}
            >
              {uploading ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"
                    aria-hidden="true"
                  />
                  {progress
                    ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                    : "Uploading…"}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  Take Photo
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="hidden"
                onChange={onFilesSelected}
                disabled={uploading}
              />
            </label>
            <label
              className={`inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors ${
                uploading ? "opacity-70 pointer-events-none" : "cursor-pointer hover:bg-muted"
              }`}
              title="Select one or more JPG/PNG photos"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload Photos
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={onFilesSelected}
                disabled={uploading}
              />
            </label>
          </div>

          {progress && (
            <div
              className="mt-2 h-1 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <div
                className="h-full bg-brand transition-all duration-200"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </>
      )}

      {locked && (
        <p className="text-xs text-muted-foreground mt-2">
          Outcome recorded — existing photos can no longer be deleted, but
          optional additions are still allowed until the limit.
        </p>
      )}

      {status && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 mt-2 rounded-lg border px-3 py-2 ${
            status.tone === "error"
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
              : "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
          }`}
        >
          <p
            className={`text-sm ${
              status.tone === "error"
                ? "text-red-600 dark:text-red-300"
                : "text-green-700 dark:text-green-300"
          }`}
          >
            {status.message}
          </p>
        </div>
      )}

      {photos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <PhotoThumb
              key={p.id}
              endpoint={endpoint}
              photo={p}
              onDelete={locked ? undefined : onDelete}
              onOpen={() => setViewerIndex(i)}
            />
          ))}
        </div>
      ) : (
        !uploading && (
          <p className="text-xs text-muted-foreground mt-2">
            No photos yet. At least one photo is required before recording a property outcome.
          </p>
        )
      )}

      {viewerIndex != null && photos[viewerIndex] && (
        <PhotoLightbox
          photos={photos.map((p) => ({
            id: p.id,
            fileName: p.file_name,
            createdAt: p.created_at,
            capturedAt: p.captured_at,
            latitude: p.latitude,
            longitude: p.longitude,
            uploadedByName: p.uploader?.display_name ?? null,
          }))}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          signUrl={signForViewer}
          contextLabel="Property photo"
        />
      )}
    </div>
  );
}
