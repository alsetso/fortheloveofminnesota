'use client';

/**
 * Campaign-only — @handle floating above the scout avatar's head.
 * Geo-anchored Mapbox marker; offset scales with zoom so it stays on the crown.
 * Pixel-deduped so walk emit + map move cannot double-place on the same frame.
 */

import { useEffect, useRef } from 'react';
import type { Marker, Map as MapboxMap } from 'mapbox-gl';
import { getAccountHandle, useAuthSafe } from '@/features/auth';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import { useMapContext } from '@/map/MapProvider';
import {
  getAvatarPresentationCoords,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';

function headOffsetPx(zoom: number): [number, number] {
  const y = -Math.min(120, Math.max(40, (zoom - 14) * 18));
  return [0, y];
}

function buildLabel(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-campaign-nameplate', '');
  el.textContent = text;
  el.style.cssText = [
    'pointer-events: none',
    'padding: 3px 8px',
    'border-radius: 999px',
    'background: rgba(8,10,12,0.62)',
    'color: #fffaf5',
    'font-size: 11px',
    'font-weight: 700',
    'letter-spacing: 0.02em',
    'line-height: 1.2',
    'white-space: nowrap',
    'backdrop-filter: blur(8px)',
    '-webkit-backdrop-filter: blur(8px)',
    'box-shadow: 0 1px 4px rgba(0,0,0,0.35)',
  ].join(';');
  return el;
}

export function CampaignAvatarNameplate() {
  const { map, ready } = useMapContext();
  const { account } = useAuthSafe();
  const handle =
    getAccountHandle(account) ??
    (account?.first_name?.trim()
      ? `@${account.first_name.trim().toLowerCase()}`
      : null);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map || !ready || !handle) return;
    let cancelled = false;
    let unsubWalk: (() => void) | null = null;
    let onMove: (() => void) | null = null;
    let lastPx = Number.NaN;
    let lastPy = Number.NaN;
    let lastOffsetY = Number.NaN;

    const place = (liveMap: MapboxMap, marker: Marker) => {
      const pose = getAvatarPresentationCoords();
      if (!pose) return;
      const p = liveMap.project([pose.lng, pose.lat]);
      const offset = headOffsetPx(liveMap.getZoom());
      if (
        Math.abs(p.x - lastPx) < 0.5 &&
        Math.abs(p.y - lastPy) < 0.5 &&
        offset[1] === lastOffsetY
      ) {
        return;
      }
      lastPx = p.x;
      lastPy = p.y;
      lastOffsetY = offset[1];
      marker.setLngLat([pose.lng, pose.lat]);
      marker.setOffset(offset);
      if (!marker.getElement().isConnected) marker.addTo(liveMap);
    };

    void loadMapboxGL().then((mapboxgl) => {
      if (cancelled || !map) return;
      const marker = new mapboxgl.Marker({
        element: buildLabel(handle),
        anchor: 'bottom',
        offset: headOffsetPx(map.getZoom()),
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport',
      });
      markerRef.current = marker;
      place(map, marker);
      unsubWalk = subscribeAvatarWalk(() => place(map, marker));
      onMove = () => place(map, marker);
      map.on('move', onMove);
    });

    return () => {
      cancelled = true;
      unsubWalk?.();
      if (onMove) map.off('move', onMove);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, ready, handle]);

  return null;
}
