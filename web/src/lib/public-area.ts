import {
  readPropertyOutcome,
  outcomeRecordedAt,
  PROPERTY_OUTCOMES,
  type PropertyOutcomeRecord,
} from "@/lib/property-outcome";
import { readOwnerName } from "@/lib/area-owner";

/**
 * Public read-only projection of a map area (owner decision, Oct 2026):
 * the public map may show the area facts, photos and availability — never
 * who drew/uploaded/recorded anything, internal descriptions, plot links
 * or activity. Everything flows through the whitelist in toPublicArea.
 */

export type AvailabilityKind = "FOR_SALE" | "UNOWNED";

export interface PublicAvailability {
  kind: AvailabilityKind;
  label: string;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  AWAITING_OUTCOME: "Awaiting outcome",
};
for (const o of Object.values(PROPERTY_OUTCOMES)) {
  STATUS_LABELS[o.status] = o.label;
}

export function readForSale(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).for_sale === true;
}

/**
 * Availability is a stored-fact observation, never an official FHA
 * clearance (AGENTS §7): FOR_SALE = the owner has listed the area for
 * sale; UNOWNED = a property/plot with no owner and no recorded outcome.
 */
export function deriveAvailability(params: {
  areaType: string;
  ownerName: string | null;
  outcome: PropertyOutcomeRecord | null;
  forSale: boolean;
}): PublicAvailability | null {
  if (params.areaType === "ZONE") return null; // containers are never sold
  if (params.forSale) {
    return { kind: "FOR_SALE", label: "Listed for sale by owner" };
  }
  if (!params.ownerName && !params.outcome) {
    return {
      kind: "UNOWNED",
      label: "No owner recorded — contact FHA to enquire",
    };
  }
  return null;
}

export interface PublicArea {
  id: string;
  name: string;
  area_type: string;
  status: string;
  status_label: string;
  geojson: unknown;
  owner_name: string | null;
  for_sale: boolean;
  availability: PublicAvailability | null;
  outcome: {
    type: string;
    label: string;
    state: string;
    recorded_at: string | null;
  } | null;
  photo_count: number;
  created_at: string;
}

export interface PublicAreaRow {
  id: string;
  name: string;
  area_type: string;
  status: string;
  geojson: unknown;
  metadata: unknown;
  created_at: string;
}

/** Strict whitelist — row fields not named here never reach the public. */
export function toPublicArea(row: PublicAreaRow, photoCount = 0): PublicArea {
  const outcome = readPropertyOutcome(row.metadata);
  const ownerName = readOwnerName(row.metadata);
  const forSale = readForSale(row.metadata);
  return {
    id: row.id,
    name: row.name,
    area_type: row.area_type,
    status: row.status,
    status_label: STATUS_LABELS[row.status] ?? row.status,
    geojson: row.geojson,
    owner_name: ownerName,
    for_sale: forSale,
    availability: deriveAvailability({
      areaType: row.area_type,
      ownerName,
      outcome,
      forSale,
    }),
    outcome: outcome
      ? {
          type: outcome.type,
          label: outcome.label,
          state: outcome.state,
          recorded_at: outcomeRecordedAt(outcome),
        }
      : null,
    photo_count: photoCount,
    created_at: row.created_at,
  };
}
