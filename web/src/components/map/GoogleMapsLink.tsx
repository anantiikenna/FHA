import { googleMapsUrl } from "@/lib/geo";

/**
 * External "View in Google Maps" link (Maps URL, no API key).
 * Viewing/reference only — never used for FHA boundaries or official data.
 * Renders nothing when coordinates are missing or invalid.
 */
export function GoogleMapsLink({
  latitude,
  longitude,
  label = "View in Google Maps",
  className = "",
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  label?: string;
  className?: string;
}) {
  const href =
    latitude == null || longitude == null ? null : googleMapsUrl(latitude, longitude);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  );
}
