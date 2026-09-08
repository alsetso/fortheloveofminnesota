/** Client fetch for GET /api/geo/directions — Find Me → Selected point. */

export type DirectionsProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

export type DirectionsResult = {
  routeId: string | null;
  profile: DirectionsProfile;
  distanceMeters: number;
  durationSeconds: number;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
  meta?: Record<string, unknown>;
  toLabel?: string | null;
};

export async function fetchDirections(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  opts?: { profile?: DirectionsProfile; toLabel?: string; signal?: AbortSignal },
): Promise<DirectionsResult> {
  const params = new URLSearchParams({
    fromLng: String(from.lng),
    fromLat: String(from.lat),
    toLng: String(to.lng),
    toLat: String(to.lat),
    profile: opts?.profile ?? 'driving',
  });
  if (opts?.toLabel) params.set('toLabel', opts.toLabel);

  const res = await fetch(`/api/geo/directions?${params}`, {
    signal: opts?.signal,
    cache: 'no-store',
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as DirectionsResult & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? 'No route found');
  }
  return data;
}
