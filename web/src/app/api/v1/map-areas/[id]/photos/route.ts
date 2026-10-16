import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { parsePhotoGps } from "@/lib/photo-gps";
import { readPropertyOutcome } from "@/lib/property-outcome";
import { ALLOWED_IMAGE_TYPES, MAX_EVIDENCE_BYTES, MAX_PHOTOS_PER_AREA } from "@/lib/photo-validate";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireActive() {
  const { user, profile } = await getProfile();
  if (!user) return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };
  if (!profile) return { error: NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 }) };
  return { user, role: profile.role, displayName: profile.display_name ?? null };
}

/** Photos are locked once a property/plot outcome has been recorded. */
function isLocked(metadata: unknown): boolean {
  const state = readPropertyOutcome(metadata)?.state;
  return state === "RECORDED" || state === "PROPOSED" || state === "ACCEPTED";
}

// GET /api/v1/map-areas/[id]/photos — list evidence photos for a map area
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } }, { status: 422 });
  }
  const supabase = await createClient();

  const { data: area } = await supabase
    .from("map_areas")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!area) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  const { data: photos, error } = await supabase
    .from("map_area_photos")
    .select("id, file_name, storage_key, mime_type, file_size, latitude, longitude, captured_at, created_at, uploaded_by, uploader:profiles(display_name)")
    .eq("area_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch photos." } }, { status: 500 });
  }

  const count = photos?.length ?? 0;
  return NextResponse.json({
    success: true,
    data: photos ?? [],
    meta: {
      locked: isLocked(area.metadata),
      count,
      max: MAX_PHOTOS_PER_AREA,
    },
  });
}

// POST /api/v1/map-areas/[id]/photos — upload an evidence photo (multipart)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } }, { status: 422 });
  }
  const supabase = await createClient();

  const { data: area } = await supabase
    .from("map_areas")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!area) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }
  // Optional additions are allowed even after an outcome is recorded (owner
  // decision) — existing photos stay immutable (DELETE is locked below);
  // the per-area cap still applies.
  const { count: existingCount, error: countError } = await supabase
    .from("map_area_photos")
    .select("id", { count: "exact", head: true })
    .eq("area_id", id);
  if (countError) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to check the photo limit." } }, { status: 500 });
  }
  if ((existingCount ?? 0) >= MAX_PHOTOS_PER_AREA) {
    return NextResponse.json(
      { success: false, error: { code: "PHOTO_LIMIT", message: `This property already has the maximum of ${MAX_PHOTOS_PER_AREA} evidence photos.` } },
      { status: 422 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: { code: "MISSING_FILE", message: "No file provided." } }, { status: 400 });
  }

  const gps = parsePhotoGps(formData.get("latitude"), formData.get("longitude"), formData.get("capturedAt"));
  if (!gps.ok) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: gps.error } }, { status: 422 });
  }

  // Same type/size rules as the client UI (shared constants).
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ success: false, error: { code: "INVALID_TYPE", message: "Only JPG/PNG allowed." } }, { status: 422 });
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return NextResponse.json({ success: false, error: { code: "FILE_TOO_LARGE", message: "Max 10MB." } }, { status: 422 });
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 4));
  const isImage =
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
  if (!isImage) {
    return NextResponse.json({ success: false, error: { code: "INVALID_TYPE", message: "File content does not match image signature." } }, { status: 422 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  // Canonical lowercase uuid — storage policies compare against m.id::text.
  const storageKey = `map-areas/${id.toLowerCase()}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("area-photos")
    .upload(storageKey, file, { contentType: file.type });
  if (uploadError) {
    console.error("area-photos storage upload failed:", uploadError.message);
    return NextResponse.json({ success: false, error: { code: "UPLOAD_FAILED", message: "Storage upload failed." } }, { status: 500 });
  }

  const { data: photo, error: dbError } = await supabase
    .from("map_area_photos")
    .insert({
      area_id: id,
      storage_key: storageKey,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: auth.user.id,
      latitude: gps.value.latitude,
      longitude: gps.value.longitude,
      captured_at: gps.value.capturedAt ?? new Date().toISOString(),
    })
    .select("id, file_name, storage_key, latitude, longitude, captured_at, created_at, uploaded_by")
    .single();

  if (dbError || !photo) {
    console.error("map_area_photos insert failed:", dbError?.code, dbError?.message);
    try { await supabase.storage.from("area-photos").remove([storageKey]); } catch { /* best effort */ }
    return NextResponse.json({ success: false, error: { code: "DB_ERROR", message: "Failed to save photo record." } }, { status: 500 });
  }

  await auditLog({ action: "UPLOAD_AREA_PHOTO", entityType: "map_area_photo", entityId: photo.id, metadata: { areaId: id, fileName: file.name } });

  return NextResponse.json(
    {
      success: true,
      data: {
        ...photo,
        uploader: auth.displayName ? { display_name: auth.displayName } : null,
      },
    },
    { status: 201 }
  );
}
