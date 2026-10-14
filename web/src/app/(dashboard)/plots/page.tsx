import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SafeImg } from "@/components/ui/safe-img";
import { readPropertyOutcome } from "@/lib/property-outcome";
import { readOwnerName } from "@/lib/area-owner";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger" | "info"> = {
  AWAITING_OUTCOME: "warning",
  APPROVED_PROPERTY: "success",
  EMPTY_UNOCCUPIED: "muted",
  UNAPPROVED_PROPERTY: "warning",
  SET_FOR_DEMOLITION: "danger",
  ACTIVE: "info",
  // Legacy rows (pre-Oct 2026 statuses):
  AWAITING_REVIEW: "warning",
  REJECTED: "danger",
  REINSPECTION_REQUIRED: "info",
  APPROVED: "success",
};

const statusLabel: Record<string, string> = {
  AWAITING_OUTCOME: "Awaiting Outcome",
  APPROVED_PROPERTY: "Approved Property",
  EMPTY_UNOCCUPIED: "Empty / Unoccupied",
  UNAPPROVED_PROPERTY: "Unapproved Property",
  SET_FOR_DEMOLITION: "Set for Demolition",
  ACTIVE: "Active",
  // Legacy:
  AWAITING_REVIEW: "Awaiting Review",
  REJECTED: "Rejected",
  REINSPECTION_REQUIRED: "Re-inspection Required",
  APPROVED: "Approved",
};

interface PropertyArea {
  id: string;
  name: string;
  status: string;
  area_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Latest evidence photo per property area, signed for a few minutes so the
// record rows can render them directly.
async function loadPropertyPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  areaIds: string[]
): Promise<Map<string, string>> {
  const byArea = new Map<string, string>();
  if (areaIds.length === 0) return byArea;
  try {
    const { data: photos } = await supabase
      .from("map_area_photos")
      .select("area_id, storage_key, created_at")
      .in("area_id", areaIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const seen = new Set<string>();
    for (const row of photos ?? []) {
      if (seen.has(row.area_id)) continue;
      const { data } = await supabase.storage
        .from("area-photos")
        .createSignedUrl(row.storage_key, 300);
      if (!data?.signedUrl) continue;
      seen.add(row.area_id);
      byArea.set(row.area_id, data.signedUrl);
      if (seen.size >= 100) break;
    }
  } catch {
    // thumbnails are optional — the record row still renders
  }
  return byArea;
}

export default async function PropertiesListPage() {
  let items: PropertyArea[] = [];
  let photoByArea = new Map<string, string>();

  try {
    const supabase = await createClient();
    const { data: areas } = await supabase
      .from("map_areas")
      .select("id, name, status, area_type, metadata, created_at")
      .eq("area_type", "PROPERTY")
      .order("created_at", { ascending: false });

    items = (areas ?? []) as unknown as PropertyArea[];
    photoByArea = await loadPropertyPhotos(supabase, items.slice(0, 100).map((a) => a.id));
  } catch {
    // Render with empty list on database error
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Properties</h1>
        <span className="text-sm text-muted-foreground">{items.length} properties</span>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="text-sm text-muted-foreground">No properties found. Draw a property on the map to record one.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((area) => {
            const owner = readOwnerName(area.metadata);
            const outcome = readPropertyOutcome(area.metadata);
            const photoUrl = photoByArea.get(area.id);
            return (
              <Link key={area.id} href={`/map?area=${area.id}`}>
                <Card className="hover:border-brand transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                      <SafeImg
                        src={photoUrl}
                        alt={`Photo of ${area.name}`}
                        className="w-full h-full object-cover"
                      />
                      {!photoUrl && (
                        <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm0 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="text-sm flex-1 min-w-0">
                      <p className="font-medium">{area.name}</p>
                      <p className="text-muted-foreground truncate">
                        Owner: {owner ?? "—"} • Recorded {area.created_at.slice(0, 10)}
                      </p>
                      {outcome && (
                        <p className="text-muted-foreground truncate">{outcome.label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant[area.status] ?? "muted"}>
                        {statusLabel[area.status] ?? area.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
