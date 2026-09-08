'use client';

/**
 * Scout camera — center dead zone.
 *
 * The avatar roams freely inside a centered viewport box
 * (CAMERA_BEHAVIOR.scout fractions) and only pushes the camera when it
 * reaches the box edge — the camera then pans by exactly the overshoot, so
 * the avatar rides the boundary while moving. Never center-locked.
 *
 * Corrections only apply while held input is actively driving the avatar
 * (isFreeMoving) — a user panning the map away is respected; the camera
 * re-engages the moment the avatar moves again and re-enters the edge.
 *
 * Behavior is configured per PresenceMode in CAMERA_BEHAVIOR so LiveKind
 * driving can define its own framing later without touching this hook.
 */

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  getAvatarPresentationCoords,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';
import { CAMERA_BEHAVIOR } from '@/map/location/positionMode/positionConstants';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';
import { isFreeMoving } from '@/map/location/positionMode/freeMoveController';

export function useFreeModeCamera(map: MapboxMap | null, ready: boolean): void {
  useEffect(() => {
    if (!map || !ready) return;

    const behavior = CAMERA_BEHAVIOR.scout;
    if (behavior.kind !== 'dead-zone') return;

    return subscribeAvatarWalk(() => {
      if (getPresenceMode() !== 'scout' || !isFreeMoving()) return;
      if (!isMapStyleReady(map)) return;
      const pose = getAvatarPresentationCoords();
      if (!pose) return;

      const container = map.getContainer();
      const w = container.clientWidth;
      // The canvas bleeds below the visible clip — center on what's on screen.
      const h = Math.max(1, container.clientHeight - MAP_CONFIG.BLEED_BOTTOM_PX);
      if (w <= 0 || h <= 1) return;

      const p = map.project([pose.lng, pose.lat]);
      const halfW = (w * behavior.widthFrac) / 2;
      const halfH = (h * behavior.heightFrac) / 2;
      const cx = w / 2;
      const cy = h / 2;

      // Overshoot past the dead-zone edge, per axis.
      const dx = p.x < cx - halfW ? p.x - (cx - halfW) : p.x > cx + halfW ? p.x - (cx + halfW) : 0;
      const dy = p.y < cy - halfH ? p.y - (cy - halfH) : p.y > cy + halfH ? p.y - (cy + halfH) : 0;
      if (dx === 0 && dy === 0) return;

      // Per-frame overshoot is at most one frame of avatar travel — an
      // instant pan here reads as the camera being glued to the zone edge.
      map.panBy([dx, dy], { duration: 0 });
    });
  }, [map, ready]);
}
