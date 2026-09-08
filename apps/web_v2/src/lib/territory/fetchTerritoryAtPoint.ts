import type { TerritoryAtPointResult } from '@/lib/territory/territoryAtPointTypes';

/** Client fetch for GET /api/territory/at-point — all jurisdictions at lat/lng. */
export async function fetchTerritoryAtPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<TerritoryAtPointResult | null> {
  const res = await fetch(
    `/api/territory/at-point?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    { signal, cache: 'no-store' },
  );
  if (!res.ok) return null;
  return (await res.json()) as TerritoryAtPointResult;
}
