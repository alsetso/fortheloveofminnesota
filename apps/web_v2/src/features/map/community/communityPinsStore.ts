import type { FeatureCollection } from 'geojson';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  fetchLiveMapPins,
  livePinsToFeatureCollection,
  type LiveMapPinsTime,
} from '@/features/map/community/liveMapPins';

type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();
/** Last unfiltered pin FeatureCollection (Explore may publish a passport-scoped subset). */
let lastRawPins: FeatureCollection | null = null;

function emit() {
  version += 1;
  for (const fn of listeners) fn();
}

/**
 * Load public community pins into `MAP_SOURCE_IDS.pins`.
 * Call after create/delete so the map updates without a full reload.
 */
export async function refreshCommunityPins(
  time: LiveMapPinsTime = 'all',
  signal?: AbortSignal,
): Promise<void> {
  try {
    const pins = await fetchLiveMapPins(time, signal);
    if (signal?.aborted) return;
    const fc = livePinsToFeatureCollection(pins);
    lastRawPins = fc;
    mapDataStore.set(MAP_SOURCE_IDS.pins, fc);
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[communityPins] loaded ${fc.features.length} pins (time=${time})`);
    }
    emit();
  } catch (e) {
    if (signal?.aborted) return;
    console.error('[communityPins]', e);
    // Still notify listeners so directory pages can load after the attempt.
    emit();
  }
}

export function clearCommunityPins(): void {
  lastRawPins = null;
  mapDataStore.clear(MAP_SOURCE_IDS.pins);
  emit();
}

/** Unfiltered pins from the last successful fetch (for Explore passport scoping). */
export function getRawCommunityPins(): FeatureCollection | null {
  return lastRawPins;
}

/** Flip a pin to seen locally so the unread ring clears without a full refetch. */
export function markCommunityPinSeen(pinId: string): void {
  const id = pinId.trim();
  if (!id) return;
  const fc = mapDataStore.get(MAP_SOURCE_IDS.pins);
  let changed = false;
  const features = fc.features.map((feature) => {
    const fid = String(feature.id ?? feature.properties?.id ?? '');
    if (fid !== id) return feature;
    if (feature.properties?.seen_by_me === 1) return feature;
    changed = true;
    return {
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        seen_by_me: 1,
      },
    };
  });
  if (!changed) return;
  mapDataStore.set(MAP_SOURCE_IDS.pins, { type: 'FeatureCollection', features });
  emit();
}

export function subscribeCommunityPinsRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCommunityPinsRefreshVersion(): number {
  return version;
}
