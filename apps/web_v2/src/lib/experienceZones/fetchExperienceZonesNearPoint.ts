import type { ExperienceZoneNearResult } from '@/lib/experienceZones/experienceZoneTypes';

/** Default approach radius — far enough to see the boundary before entry. */
export const EXPERIENCE_ZONE_APPROACH_RADIUS_M = 350;

/** Client fetch for GET /api/experience-zones/near-point. */
export async function fetchExperienceZonesNearPoint(
  lat: number,
  lng: number,
  radiusM: number = EXPERIENCE_ZONE_APPROACH_RADIUS_M,
  signal?: AbortSignal,
): Promise<ExperienceZoneNearResult | null> {
  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusM: String(radiusM),
  });
  const res = await fetch(`/api/experience-zones/near-point?${qs}`, {
    signal,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as ExperienceZoneNearResult;
}
