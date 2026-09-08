import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

export type SelectionKind = Extract<
  DockEntity['kind'],
  | 'county'
  | 'ctu'
  | 'school_district'
  | 'school'
  | 'district'
  | 'district_part'
  | 'senate_district'
  | 'house_district'
>;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

let inflightKey: string | null = null;
let inflight: Promise<FeatureCollection> | null = null;

function selectionKey(kind: SelectionKind, id: string): string {
  return `${kind}:${id}`;
}

/** Clear the independent selection highlight (does not touch Controls layers). */
export function clearTerritorySelection(): void {
  inflightKey = null;
  inflight = null;
  mapDataStore.clear(MAP_SOURCE_IDS.selection);
}

function featureFromStore(kind: SelectionKind, id: string): Feature<Geometry> | null {
  // Prefer an already-loaded layer feature when present (avoids a fetch).
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
  const fc = mapDataStore.get(sourceByKind[kind]);
  const match = fc.features.find((f) => {
    const fid = f.id ?? f.properties?.id;
    return fid != null && String(fid) === id;
  });
  return (match as Feature<Geometry> | undefined) ?? null;
}

async function fetchSelectionFc(
  kind: SelectionKind,
  id: string,
  signal?: AbortSignal,
): Promise<FeatureCollection> {
  const res = await fetch(
    `/api/territory/selection?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
    { signal },
  );
  if (!res.ok) {
    if (res.status === 404) return EMPTY;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load selection');
  }
  return (await res.json()) as FeatureCollection;
}

/**
 * Paint only this boundary on the independent selection source.
 * Does not call ensureActive / toggle Controls layers.
 */
export async function showTerritorySelection(
  kind: SelectionKind,
  id: string,
  options?: { signal?: AbortSignal },
): Promise<FeatureCollection> {
  const key = selectionKey(kind, id);

  // Already showing this feature.
  const current = mapDataStore.get(MAP_SOURCE_IDS.selection);
  const currentId = current.features[0]?.id ?? current.features[0]?.properties?.id;
  if (
    current.features.length === 1 &&
    currentId != null &&
    String(currentId) === id &&
    current.features[0]?.properties?.kind === kind
  ) {
    return current;
  }

  const local = featureFromStore(kind, id);
  if (local?.geometry) {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          ...local,
          id,
          properties: { ...(local.properties ?? {}), id, kind },
        },
      ],
    };
    mapDataStore.set(MAP_SOURCE_IDS.selection, fc);
    return fc;
  }

  if (inflightKey === key && inflight) {
    return inflight;
  }

  inflightKey = key;
  const promise = (async () => {
    const fc = await fetchSelectionFc(kind, id, options?.signal);
    if (options?.signal?.aborted) return EMPTY;
    // Ignore stale responses if a newer selection started.
    if (inflightKey !== key) return EMPTY;
    mapDataStore.set(MAP_SOURCE_IDS.selection, fc);
    return fc;
  })();
  inflight = promise;

  try {
    return await promise;
  } finally {
    if (inflightKey === key) {
      inflightKey = null;
      inflight = null;
    }
  }
}
