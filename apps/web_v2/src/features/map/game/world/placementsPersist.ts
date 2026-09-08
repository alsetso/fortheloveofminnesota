/** Load / save world.world_placements via /api/world/placements. */

import type { WorldModelSlug } from '@/features/map/game/world/catalog';
import { getWorldPlaceMode } from '@/features/map/game/world/placeModeStore';
import {
  addWorldPlacement,
  replaceWorldPlacementId,
  setWorldPlacements,
} from '@/features/map/game/world/placementsStore';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import { maybeSnapToGrid } from '@/features/map/game/world/worldGrid';
import type { UserCoords } from '@/map/location/device/geolocation';

type PlacementDto = {
  id: string;
  lat: number;
  lng: number;
  kind: WorldModelSlug;
  slug?: string;
  scaleMultiplier?: number | null;
  rotationZ?: number | null;
  altitudeMeters?: number | null;
};

/** Fetch visible placements and hydrate the map store.
 * `coords`, when available, lets the server resolve a cold-start CTU scope
 * on the very first load (before any territory has been unlocked yet). */
export async function loadWorldPlacements(coords?: UserCoords | null): Promise<number> {
  try {
    const query =
      coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)
        ? `?lat=${coords.lat}&lng=${coords.lng}`
        : '';
    const res = await fetch(`/api/world/placements${query}`, { cache: 'no-store' });
    if (!res.ok) {
      console.error('loadWorldPlacements', res.status);
      return 0;
    }
    const json = (await res.json()) as { placements?: PlacementDto[] };
    const list = json.placements ?? [];
    setWorldPlacements(
      list.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        kind: p.kind || p.slug || '',
        scaleMultiplier: p.scaleMultiplier ?? 1,
        // Preserve null — coalesce to catalog defaults at render time
        rotationZ: p.rotationZ ?? null,
        altitudeMeters: p.altitudeMeters ?? null,
      })),
    );
    return list.length;
  } catch (err) {
    console.error('loadWorldPlacements', err);
    return 0;
  }
}

/** Optimistic local place, then persist (requires signed-in session). */
export async function placeWorldModel(
  coords: UserCoords,
  slug?: WorldModelSlug,
): Promise<{ ok: boolean; id: string | null; error?: string }> {
  const modeSlug = slug ?? getWorldPlaceMode();
  if (modeSlug === 'off') {
    return { ok: false, id: null, error: 'No active place mode' };
  }

  // Snap block-category models to the 8 m world grid before placing.
  const model = getWorldModel(modeSlug);
  const snapped = maybeSnapToGrid(coords.lat, coords.lng, model?.category);
  const placedCoords: UserCoords = { ...coords, lat: snapped.lat, lng: snapped.lng };

  const localId = addWorldPlacement(placedCoords, modeSlug);
  if (!localId) return { ok: false, id: null, error: 'Place failed' };

  try {
    const res = await fetch('/api/world/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: modeSlug,
        kind: modeSlug,
        lat: placedCoords.lat,
        lng: placedCoords.lng,
      }),
    });
    const json = (await res.json()) as {
      placement?: PlacementDto;
      error?: string;
    };
    if (!res.ok || !json.placement) {
      return {
        ok: false,
        id: localId,
        error: json.error ?? `Save failed (${res.status})`,
      };
    }
    replaceWorldPlacementId(localId, json.placement.id);
    return { ok: true, id: json.placement.id };
  } catch (err) {
    console.error('placeWorldModel', err);
    return { ok: false, id: localId, error: 'Network error' };
  }
}
