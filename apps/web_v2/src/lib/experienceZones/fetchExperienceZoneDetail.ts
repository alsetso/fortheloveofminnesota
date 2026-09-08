/** Client fetch for GET /api/experience-zones/[id] (Discover zone detail). */

import type { MultiPolygon, Polygon } from 'geojson';

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  ) {
    return true;
  }
  if (err instanceof Error && /abort/i.test(err.message)) return true;
  return false;
}

export type ExperienceZoneDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  geometry: Polygon | MultiPolygon | null;
  placementCount: number | null;
  collectionCount: number;
  subZoneCount: number;
};

export type ExperienceZoneSubZone = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  geometry: Polygon | MultiPolygon | null;
};

export type ExperienceZoneCollection = {
  slug: string;
  label: string;
  description: string | null;
  placementCount: number;
};

export type ExperienceZoneDetailResult = {
  zone: ExperienceZoneDetail;
  subZones: ExperienceZoneSubZone[];
  collections: ExperienceZoneCollection[];
};

export async function fetchExperienceZoneDetail(
  id: string,
  signal?: AbortSignal,
): Promise<ExperienceZoneDetailResult | null> {
  try {
    const res = await fetch(`/api/experience-zones/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as ExperienceZoneDetailResult;
    if (!json?.zone?.id) return null;
    return {
      zone: json.zone,
      subZones: Array.isArray(json.subZones) ? json.subZones : [],
      collections: Array.isArray(json.collections) ? json.collections : [],
    };
  } catch (err) {
    if (isAbortError(err)) return null;
    return null;
  }
}
