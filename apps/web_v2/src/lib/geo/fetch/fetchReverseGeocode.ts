/** Client fetch for GET /api/geo/reverse — address at a point. */

export type ReverseGeocodeResult = {
  address: string | null;
  outsideMinnesota?: boolean;
  error?: string;
};

export async function fetchReverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await fetchReverseGeocodeDetailed(lat, lng, signal);
  return result.address;
}

export async function fetchReverseGeocodeDetailed(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const res = await fetch(
    `/api/geo/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    { signal, cache: 'no-store' },
  );
  const data = (await res.json().catch(() => ({}))) as {
    address?: string | null;
    error?: string;
    outsideMinnesota?: boolean;
  };

  if (res.status === 422 || data.outsideMinnesota) {
    return {
      address: null,
      outsideMinnesota: true,
      error: data.error,
    };
  }
  if (!res.ok) {
    return { address: null, error: data.error ?? 'Reverse geocode failed' };
  }
  return { address: data.address?.trim() || null };
}
