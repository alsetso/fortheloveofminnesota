import type { FeatureCollection } from 'geojson';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  directoryPagesToFeatureCollection,
  fetchDirectoryPages,
} from '@/features/map/directory/directoryPages';

type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();
/** Last unfiltered pages FeatureCollection (Explore may publish a passport-scoped subset). */
let lastRawPages: FeatureCollection | null = null;

function emit() {
  version += 1;
  for (const fn of listeners) fn();
}

/**
 * Load public user-generated directory pages into `MAP_SOURCE_IDS.pages`.
 */
export async function refreshDirectoryPages(signal?: AbortSignal): Promise<void> {
  try {
    const pages = await fetchDirectoryPages(signal);
    if (signal?.aborted) return;
    const fc = directoryPagesToFeatureCollection(pages);
    lastRawPages = fc;
    mapDataStore.set(MAP_SOURCE_IDS.pages, fc);
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[directoryPages] loaded ${fc.features.length} pages`);
    }
    emit();
  } catch (e) {
    if (signal?.aborted) return;
    console.error('[directoryPages]', e);
  }
}

export function clearDirectoryPages(): void {
  lastRawPages = null;
  mapDataStore.clear(MAP_SOURCE_IDS.pages);
  emit();
}

/** Unfiltered pages from the last successful fetch (for Explore passport scoping). */
export function getRawDirectoryPages(): FeatureCollection | null {
  return lastRawPages;
}

export function subscribeDirectoryPagesRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDirectoryPagesRefreshVersion(): number {
  return version;
}
