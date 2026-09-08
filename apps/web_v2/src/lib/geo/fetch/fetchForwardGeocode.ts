/** Client fetch for GET /api/geo/forward — Minnesota-biased place search. */

export type ForwardGeocodeHit = {
  id: string;
  /** Full Mapbox label, e.g. "123 Main St, Minneapolis, Minnesota 55401, United States". */
  name: string;
  lat: number;
  lng: number;
};

/** Below this the geocoder has nothing useful to say. */
export const FORWARD_GEOCODE_MIN_QUERY = 2;

export async function fetchForwardGeocode(
  query: string,
  signal?: AbortSignal,
  limit = 8,
): Promise<ForwardGeocodeHit[]> {
  const q = query.trim();
  if (q.length < FORWARD_GEOCODE_MIN_QUERY) return [];

  const res = await fetch(
    `/api/geo/forward?q=${encodeURIComponent(q)}&limit=${limit}`,
    { signal, cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Search failed');

  const data = (await res.json().catch(() => ({}))) as { hits?: ForwardGeocodeHit[] };
  return data.hits ?? [];
}
