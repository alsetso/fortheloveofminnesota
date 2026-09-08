import type { ExperienceZoneAtPointResult } from '@/lib/experienceZones/experienceZoneTypes';

/** Client fetch for GET /api/experience-zones/at-point. */
export async function fetchExperienceZoneAtPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ExperienceZoneAtPointResult | null> {
  const res = await fetch(
    `/api/experience-zones/at-point?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    { signal, cache: 'no-store' },
  );
  if (!res.ok) return null;
  return (await res.json()) as ExperienceZoneAtPointResult;
}
