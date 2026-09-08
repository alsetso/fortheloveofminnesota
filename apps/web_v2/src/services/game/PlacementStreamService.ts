/**
 * PlacementStreamService — tile-cache streaming for world placements.
 *
 * Maintains a per-tile cache of placement DTOs. As the player walks:
 *   - Added tiles → fetch placements for that tile's bbox → merge into store
 *   - Removed tiles → evict from cache → remove stale placements from store
 *
 * Deduplicates placements that straddle tile boundaries (same id in 2 tiles).
 * The global placement store always reflects exactly what the viewport cache holds.
 *
 * Mode-aware tile sourcing:
 *   follow (Locked)  — viewport IS the player; viewport tiles drive fetches.
 *   free   (Explore) — camera wanders; only GPS-anchored tiles are ever fetched.
 *                      Camera pans do not trigger tile additions or evictions.
 *                      refresh() recalculates tiles from GPS, evicts drift tiles.
 *
 * This enforces the travel mechanic: players only see placements they can
 * physically reach, even while exploring the full Minnesota map.
 *
 * Designed to be a singleton per game session — call `createPlacementStreamService`
 * once, subscribe to the tile viewport, and tear down on unmount.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import type { TileId } from './TileViewportService';
import {
  latLngToTile,
  subscribeViewportTiles,
  tileSetToBbox,
} from './TileViewportService';
import {
  setWorldPlacements,
  removeWorldPlacement,
} from '@/features/map/game/world/placementsStore';
import type { WorldPlacementRaw } from '@/features/map/game/world/placementsStore';
import { PLACEMENT_MOVE_REFRESH_THRESHOLD_M } from '@/features/map/game/world/placementBudget';
import { haversineMeters } from '@/features/map/game/world/placementPriority';
import { getPlacementStreamZoneId } from '@/features/experienceZones/store/venueModeStore';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import {
  getPresenceOrigin,
  isPresenceScout,
} from '@/map/location/positionMode/playerPresenceOrigin';

/** Tile zoom used for streaming — matches game lock zoom, snapped to integer. */
export const STREAM_TILE_ZOOM = 18;

/**
 * Number of tiles in each direction around the player's GPS tile to load.
 * 1 = 3×3 block = ~114m × ~114m at z18 (enough for nearby objects + 1-tile pre-load).
 */
const GPS_TILE_RADIUS = 1;

type FetchState = 'idle' | 'fetching' | 'done' | 'error';

interface TileCacheEntry {
  state: FetchState;
  placements: WorldPlacementRaw[];
}

/**
 * Returns the set of tiles covering a GPS_TILE_RADIUS-padded window around
 * the player's position at STREAM_TILE_ZOOM. This is the source of truth for
 * what tiles should be loaded while in Explore mode.
 */
function getGpsTiles(lat: number, lng: number): Set<TileId> {
  const [z, x, y] = latLngToTile(lat, lng, STREAM_TILE_ZOOM)
    .split('/')
    .map(Number) as [number, number, number];
  const r = GPS_TILE_RADIUS;
  const tiles = new Set<TileId>();
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      tiles.add(`${z}/${x + dx}/${y + dy}` as TileId);
    }
  }
  return tiles;
}

/**
 * Merge all cached placements into one deduplicated array and push to the store.
 * ID is the canonical dedup key — placements near tile boundaries may appear
 * in two adjacent tile fetches but should render exactly once.
 */
function flushToStore(cache: Map<TileId, TileCacheEntry>): void {
  const seen = new Set<string>();
  const merged: WorldPlacementRaw[] = [];
  for (const entry of cache.values()) {
    if (entry.state !== 'done') continue;
    for (const p of entry.placements) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        merged.push(p);
      }
    }
  }
  setWorldPlacements(merged);
}

export interface PlacementStreamService {
  /** Attach to a live Mapbox map and begin streaming. Returns unsubscribe fn. */
  start(map: MapboxMap): () => void;
  /** Reload the tile under the given coords (e.g. on move-refresh threshold). */
  refresh(lat: number, lng: number): Promise<void>;
  /**
   * Force-refresh all currently-cached tiles regardless of move distance.
   * Used by the manual refresh button — bypasses the haversine throttle.
   */
  forceRefresh(): Promise<void>;
  /** Clear all cached tiles and reset the store. */
  reset(): void;
}

export function createPlacementStreamService(): PlacementStreamService {
  const tileCache = new Map<TileId, TileCacheEntry>();
  let lastRefreshCoords: { lat: number; lng: number } | null = null;
  let abortController: AbortController | null = null;
  /** Coalesce overlapping fetches — abort storms were a primary Failed-to-fetch source. */
  let pendingTiles = new Set<TileId>();
  let pumpPromise: Promise<void> | null = null;

  async function doFetch(tileIds: Set<TileId>): Promise<void> {
    if (tileIds.size === 0) return;

    const bbox = tileSetToBbox(tileIds);
    if (!bbox) return;

    for (const id of tileIds) {
      const existing = tileCache.get(id);
      if (!existing || existing.state === 'idle' || existing.state === 'error') {
        tileCache.set(id, {
          state: 'fetching',
          placements: existing?.placements ?? [],
        });
      }
    }

    const controller = new AbortController();
    abortController = controller;

    try {
      const params = new URLSearchParams({
        bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
      });
      const snap = getFindMeCoordsSnapshot();
      const gps = snap.coords ?? snap.lookupCoords;
      if (gps) {
        params.set('lat', String(gps.lat));
        params.set('lng', String(gps.lng));
      }
      const zoneId = getPlacementStreamZoneId();
      if (zoneId) params.set('experienceZoneId', zoneId);
      const res = await fetch(`/api/world/placements?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!res.ok) {
        for (const id of tileIds) {
          tileCache.set(id, { state: 'error', placements: [] });
        }
        return;
      }

      const json = (await res.json()) as {
        placements?: Array<{
          id: string;
          lat: number;
          lng: number;
          kind?: string;
          slug?: string;
          scaleMultiplier?: number | null;
          rotationZ?: number | null;
          altitudeMeters?: number | null;
          overrides?: Record<string, unknown> | null;
        }>;
      };

      const raw: WorldPlacementRaw[] = (json.placements ?? []).map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        kind: p.kind || p.slug || '',
        scaleMultiplier: p.scaleMultiplier ?? 1,
        rotationZ: p.rotationZ ?? null,
        altitudeMeters: p.altitudeMeters ?? null,
        overrides: p.overrides ?? null,
      }));

      for (const id of tileIds) {
        tileCache.set(id, { state: 'done', placements: raw });
      }

      flushToStore(tileCache);
    } catch (err) {
      // Aborts leave tiles stuck in `fetching` unless we reset — that blocked
      // later refreshes and caused repeated Failed-to-fetch / empty maps.
      if ((err as Error)?.name === 'AbortError') {
        for (const id of tileIds) {
          const entry = tileCache.get(id);
          if (entry?.state === 'fetching') {
            tileCache.set(id, {
              state: 'idle',
              placements: entry.placements,
            });
          }
        }
        return;
      }
      for (const id of tileIds) {
        const entry = tileCache.get(id);
        if (entry?.state === 'fetching') {
          tileCache.set(id, { state: 'error', placements: [] });
        }
      }
    } finally {
      if (abortController === controller) abortController = null;
    }
  }

  async function pump(): Promise<void> {
    while (pendingTiles.size > 0) {
      const batch = pendingTiles;
      pendingTiles = new Set();
      const toFetch = new Set<TileId>();
      for (const id of batch) {
        const entry = tileCache.get(id);
        if (!entry || entry.state === 'idle' || entry.state === 'error') {
          toFetch.add(id);
        }
      }
      if (toFetch.size > 0) await doFetch(toFetch);
    }
  }

  async function fetchTiles(tileIds: Set<TileId>): Promise<void> {
    for (const id of tileIds) pendingTiles.add(id);
    if (pendingTiles.size === 0 && !pumpPromise) return;
    if (!pumpPromise) {
      pumpPromise = pump().finally(() => {
        pumpPromise = null;
        if (pendingTiles.size > 0) void fetchTiles(new Set());
      });
    }
    await pumpPromise;
  }

  function evictTiles(tileIds: Set<TileId>): void {
    const idsToRemove = new Set<string>();

    // Collect placement IDs that live exclusively in evicted tiles
    const survivingIds = new Set<string>();
    for (const [tileId, entry] of tileCache) {
      if (!tileIds.has(tileId)) {
        for (const p of entry.placements) survivingIds.add(p.id);
      }
    }
    for (const tileId of tileIds) {
      const entry = tileCache.get(tileId);
      if (!entry) continue;
      for (const p of entry.placements) {
        if (!survivingIds.has(p.id)) idsToRemove.add(p.id);
      }
      tileCache.delete(tileId);
    }

    // Evict placements that are no longer visible in any surviving tile
    for (const id of idsToRemove) {
      removeWorldPlacement(id);
    }
  }

  function start(map: MapboxMap): () => void {
    const unsub = subscribeViewportTiles(
      map,
      STREAM_TILE_ZOOM,
      (added, removed) => {
        if (isPresenceScout()) {
          // Explore mode — camera can be anywhere in Minnesota.
          // Never add tiles based on what the camera sees; tile loading
          // is driven exclusively by GPS via refresh() calls from WorldModelsLayer.
          // This prevents fetching placements for cities the player hasn't visited.
          return;
        }
        // Locked mode — viewport is pinned to the player; viewport tiles = player tiles.
        if (removed.size > 0) evictTiles(removed);
        if (added.size > 0) void fetchTiles(added);
      },
    );

    return () => {
      unsub();
      abortController?.abort();
      abortController = null;
    };
  }

  async function refresh(lat: number, lng: number): Promise<void> {
    if (lastRefreshCoords) {
      const dist = haversineMeters(
        lastRefreshCoords.lat,
        lastRefreshCoords.lng,
        lat,
        lng,
      );
      if (dist < PLACEMENT_MOVE_REFRESH_THRESHOLD_M) return;
    }
    lastRefreshCoords = { lat, lng };

    if (isPresenceScout()) {
      // Explore mode: recalculate tiles from GPS position.
      // Evict any tiles that have drifted outside the GPS window (camera-pan
      // residue or tiles from a previous city), then fetch the GPS window.
      const gpsTiles = getGpsTiles(lat, lng);

      const toEvict = new Set<TileId>();
      for (const id of tileCache.keys()) {
        if (!gpsTiles.has(id)) toEvict.add(id);
      }
      if (toEvict.size > 0) evictTiles(toEvict);

      const toFetch = new Set<TileId>();
      for (const id of gpsTiles) {
        const entry = tileCache.get(id);
        if (!entry || entry.state === 'idle' || entry.state === 'error') {
          toFetch.add(id);
          tileCache.set(id, { state: 'idle', placements: entry?.placements ?? [] });
        }
      }
      if (toFetch.size > 0) await fetchTiles(toFetch);
      return;
    }

    // Locked mode: re-fetch all currently cached viewport tiles (player moved).
    const activeTiles = new Set<TileId>(tileCache.keys());
    if (activeTiles.size > 0) {
      for (const id of activeTiles) {
        tileCache.set(id, { state: 'idle', placements: [] });
      }
      await fetchTiles(activeTiles);
    }
  }

  async function forceRefresh(): Promise<void> {
    // Bypass haversine throttle — clear last coords so the next refresh proceeds.
    lastRefreshCoords = null;

    if (isPresenceScout()) {
      // Explore mode: re-resolve GPS tiles to ensure we have the right window.
      const origin = getPresenceOrigin();
      if (origin.hasFix) {
        await refresh(origin.lat, origin.lng);
      }
      return;
    }

    const activeTiles = new Set<TileId>(tileCache.keys());
    if (activeTiles.size === 0) return;
    for (const id of activeTiles) {
      tileCache.set(id, { state: 'idle', placements: [] });
    }
    await fetchTiles(activeTiles);
  }

  function reset(): void {
    abortController?.abort();
    abortController = null;
    tileCache.clear();
    lastRefreshCoords = null;
    setWorldPlacements([]);
  }

  return { start, refresh, forceRefresh, reset };
}
