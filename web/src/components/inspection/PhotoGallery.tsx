"use client";
import { useState, useEffect, useCallback } from "react";
import { PhotoThumb, type UploadedPhoto } from "./PhotoThumb";

/**
 * Read-only site-photo gallery for an inspection (evidence trail).
 * Thumbnails load via short-lived signed URLs from the auth-gated endpoint.
 */
export function PhotoGallery({ inspectionId }: { inspectionId: string }) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/v1/inspections/${inspectionId}/photos`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setPhotos(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Site Photos</h3>
        {!loading && photos.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading photos…</p>
      ) : photos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <PhotoThumb key={p.id} inspectionId={inspectionId} photo={p} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No photos attached to this inspection.</p>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Photos are stored securely and only accessible to authorised staff. Hover a thumbnail for its captured coordinates.
      </p>
    </div>
  );
}
