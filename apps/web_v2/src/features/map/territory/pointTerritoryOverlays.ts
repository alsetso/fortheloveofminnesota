/**
 * Multi-boundary overlays for jurisdictions at a selected / Find Me point.
 * Independent of Controls layers and the single-feature details selection.
 */

import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { SelectionKind } from '@/features/map/territory/territorySelection';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export type PointTerritoryKey = {
  kind: SelectionKind;
  id: string;
  /** Hex fill shared by the dock switch and map overlay. */
  color?: string;
};

function overlayKey(kind: SelectionKind, id: string): string {
  return `${kind}:${id}`;
}

const featureCache = new Map<string, Feature<Geometry>>();
let syncGen = 0;

export function isPointTerritoryKind(kind: string): kind is SelectionKind {
  return (
    kind === 'county' ||
    kind === 'ctu' ||
    kind === 'school_district' ||
    kind === 'school' ||
    kind === 'district' ||
    kind === 'district_part' ||
    kind === 'senate_district' ||
    kind === 'house_district'
  );
}

/** Clear point-jurisdiction overlays (does not touch Controls or details selection). */
export function clearPointTerritoryOverlays(): void {
  syncGen += 1;
  mapDataStore.clear(MAP_SOURCE_IDS.pointTerritories);
}

/**
 * Paint the given jurisdictions onto the point-territories source.
 * Pass an empty list to clear. Fetches missing geometries in parallel.
 */
export async function syncPointTerritoryOverlays(
  items: PointTerritoryKey[],
  options?: { signal?: AbortSignal },
): Promise<void> {
  const generation = ++syncGen;
  const signal = options?.signal;

  if (items.length === 0) {
    if (generation === syncGen) mapDataStore.clear(MAP_SOURCE_IDS.pointTerritories);
    return;
  }

  const features: Feature<Geometry>[] = [];
  const missing: PointTerritoryKey[] = [];

  for (const item of items) {
    const key = overlayKey(item.kind, item.id);
    const cached = featureCache.get(key);
    if (cached?.geometry) {
      features.push({
        ...cached,
        properties: {
          ...(cached.properties ?? {}),
          id: item.id,
          kind: item.kind,
          overlayColor: item.color ?? cached.properties?.overlayColor,
          overlayKey: key,
        },
      });
    } else {
      missing.push(item);
    }
  }

  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (item) => {
        try {
          const fc = await fetchOverlayFeature(item.kind, item.id, signal);
          const feature = fc.features[0] as Feature<Geometry> | undefined;
          if (!feature?.geometry) return;
          const key = overlayKey(item.kind, item.id);
          const keyed: Feature<Geometry> = {
            ...feature,
            id: item.id,
            properties: {
              ...(feature.properties ?? {}),
              id: item.id,
              kind: item.kind,
              overlayColor: item.color,
              overlayKey: key,
            },
          };
          featureCache.set(key, keyed);
          features.push(keyed);
        } catch {
          /* best-effort per jurisdiction */
        }
      }),
    );
  }

  if (signal?.aborted || generation !== syncGen) return;

  const wanted = new Set(items.map((i) => overlayKey(i.kind, i.id)));
  const next: FeatureCollection = {
    type: 'FeatureCollection',
    features: features.filter((f) => {
      const kind = String(f.properties?.kind ?? '');
      const id = String(f.id ?? f.properties?.id ?? '');
      return wanted.has(`${kind}:${id}`);
    }),
  };
  mapDataStore.set(MAP_SOURCE_IDS.pointTerritories, next);
}

async function fetchOverlayFeature(
  kind: SelectionKind,
  id: string,
  signal?: AbortSignal,
): Promise<FeatureCollection> {
  const sourceByKind: Record<SelectionKind, string> = {
    county: MAP_SOURCE_IDS.counties,
    ctu: MAP_SOURCE_IDS.ctus,
    school_district: MAP_SOURCE_IDS.schoolDistricts,
    school: MAP_SOURCE_IDS.schools,
    district: MAP_SOURCE_IDS.districts,
    district_part: MAP_SOURCE_IDS.districtParts,
    senate_district: MAP_SOURCE_IDS.senateDistricts,
    house_district: MAP_SOURCE_IDS.houseDistricts,
  };
  const local = mapDataStore.get(sourceByKind[kind]).features.find((f) => {
    const fid = f.id ?? f.properties?.id;
    return fid != null && String(fid) === id;
  }) as Feature<Geometry> | undefined;
  if (local?.geometry) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          ...local,
          id,
          properties: { ...(local.properties ?? {}), id, kind },
        },
      ],
    };
  }

  const res = await fetch(
    `/api/territory/selection?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
    { signal },
  );
  if (!res.ok) {
    if (res.status === 404) return EMPTY;
    throw new Error('Failed to load territory overlay');
  }
  const fc = (await res.json()) as FeatureCollection;
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({
      ...f,
      id: f.id ?? id,
      properties: { ...(f.properties ?? {}), id, kind },
    })),
  };
}
