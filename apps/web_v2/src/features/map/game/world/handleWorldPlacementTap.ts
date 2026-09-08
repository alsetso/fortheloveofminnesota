/**
 * World placement tap — dispatches by ObjectClass.
 *
 * Classification is two-axis (interaction + on_collect) via classifyObject().
 * Purpose is never read here.
 *
 * Unimplemented classes degrade safely: unlock/redeem/challenge → info card.
 */

import {
  getObjectRadarState,
  objectRadarActions,
} from '@/features/map/game/objectRadar/objectRadarStore';
import { distanceMeters } from '@/features/map/game/objectRadar/range';
import type { WorldModelSlug } from '@/features/map/game/world/catalog';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import {
  classifyObject,
  effectiveVerb,
  resolveModelVerb,
} from '@/features/map/game/world/modelVerbs';
import { getPresenceOrigin } from '@/map/location/positionMode/playerPresenceOrigin';
import type { UserCoords } from '@/map/location/device/geolocation';
import {
  closeWorldPlacementFound,
  openWorldPlacementFound,
} from '@/features/map/game/world/placementFoundStore';
import {
  closeWorldPlacementRoute,
  openWorldPlacementRoute,
} from '@/features/map/game/world/placementRouteStore';
import {
  getWorldPlacementsRaw,
  getWorldPlacementsSnapshot,
} from '@/features/map/game/world/placementsStore';
import {
  closePostDetailCard,
  openPostDetailCard,
} from '@/features/community/postDetailCardStore';

// ── Coordinate helpers ─────────────────────────────────────────────────────

export function resolveWorldPlacementCoords(
  featureId: string | number,
): UserCoords | null {
  const id = String(featureId);
  const raw = getWorldPlacementsRaw().find((p) => p.id === id);
  if (raw) return { lat: raw.lat, lng: raw.lng };

  const feature = getWorldPlacementsSnapshot().features.find(
    (f) => String(f.id) === id || String(f.properties?.id ?? '') === id,
  );
  const coords = feature?.geometry?.coordinates;
  if (
    feature?.geometry?.type === 'Point' &&
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])
  ) {
    return { lng: coords[0], lat: coords[1] };
  }
  return null;
}

function playerCoords(): UserCoords | null {
  const origin = getPresenceOrigin();
  if (!origin.hasFix) return null;
  return { lat: origin.lat, lng: origin.lng };
}

function openRoute(
  kind: WorldModelSlug,
  featureId: string | number,
  to: UserCoords,
  distanceM: number | null,
  rangeM: number,
): void {
  closeWorldPlacementFound();
  objectRadarActions.closeSheet();
  openWorldPlacementRoute({ kind, featureId, lat: to.lat, lng: to.lng, distanceM, rangeM });
}

function openFound(kind: WorldModelSlug, featureId: string | number): void {
  closeWorldPlacementRoute();
  openWorldPlacementFound(kind, featureId);
}

// ── Main tap handler ───────────────────────────────────────────────────────

/**
 * Dispatch a tap on a world object.
 *
 * prop     → silent, no card
 * route    → always open route modal
 * info     → in-range: info card; out-of-range: route modal
 * collect (collectible / discovery) → in-range: found card; out-of-range: route modal
 * check_in → in-range: check-in found card; out-of-range: route modal
 * unlock / redeem / challenge → degrade to info card until those verbs ship
 */
export function handleWorldPlacementTap(
  kind: WorldModelSlug,
  featureId: string | number,
  coordsOverride?: UserCoords | null,
): void {
  const model = getWorldModel(kind);
  const verb = resolveModelVerb(model?.interaction);
  const eff = effectiveVerb(verb);

  // ── Community post placements — open PostDetailCard instead of claim flow ──
  // community-* models carry overrides.postId set by auto_placement_for_post().
  if (String(kind).startsWith('community-')) {
    const raw = getWorldPlacementsRaw().find((p) => p.id === String(featureId));
    const postId = typeof raw?.overrides?.postId === 'string' ? raw.overrides.postId : null;
    if (postId) {
      closeWorldPlacementFound();
      closeWorldPlacementRoute();
      openPostDetailCard(postId);
      return;
    }
  }

  // ── Silent props ───────────────────────────────────────────────────────────
  if (eff === 'see') return;

  // ── Route — always offer navigation regardless of proximity ───────────────
  if (eff === 'route') {
    const to = coordsOverride ?? resolveWorldPlacementCoords(featureId);
    if (!to) {
      openFound(kind, featureId); // no coords → degrade to info card
      return;
    }
    const from = playerCoords();
    const distanceM = from
      ? distanceMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng })
      : null;
    openRoute(kind, featureId, to, distanceM, getObjectRadarState().rangeM);
    return;
  }

  // ── All claimable + info verbs: proximity gate ────────────────────────────
  // info / collect / check_in / (unlock/redeem/challenge degraded to info)
  const to = coordsOverride ?? resolveWorldPlacementCoords(featureId);
  if (!to) {
    openFound(kind, featureId);
    return;
  }

  const from = playerCoords();
  if (!from) {
    // No GPS — show route card so user can navigate there first
    openRoute(kind, featureId, to, null, getObjectRadarState().rangeM);
    return;
  }

  const distanceM = distanceMeters(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng },
  );
  const rangeM = getObjectRadarState().rangeM;

  if (distanceM <= rangeM) {
    openFound(kind, featureId);
  } else {
    openRoute(kind, featureId, to, distanceM, rangeM);
  }
}
