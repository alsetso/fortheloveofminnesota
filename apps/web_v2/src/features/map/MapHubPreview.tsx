'use client';

/**
 * Full-bleed Mapbox hero for the `/map` Play hub.
 * Streets style; frame crops the bottom 2rem of the canvas so the visible
 * composition reads tighter (same crop pattern as Discover visited maps).
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { IconMapPin } from '@/features/map/dockCore/core/icons';
import { GAME_PATH } from '@/lib/routes/routePolicy';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import {
  getFindMeCoordsSnapshot,
  subscribePassiveFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';

/** Visible frame crops this much off the bottom of the Mapbox canvas. */
const CROP_BOTTOM_REM = 2;

function resolvePreviewCenter(): { lng: number; lat: number; fromUser: boolean } {
  const live = getFindMeCoordsSnapshot().displayCoords ?? getFindMeCoordsSnapshot().coords;
  if (live && Number.isFinite(live.lat) && Number.isFinite(live.lng)) {
    return { lng: live.lng, lat: live.lat, fromUser: true };
  }
  const cached = getFindMeLastCoords();
  if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng)) {
    return { lng: cached.lng, lat: cached.lat, fromUser: true };
  }
  return {
    lng: MAP_CONFIG.DEFAULT_CENTER[0],
    lat: MAP_CONFIG.DEFAULT_CENTER[1],
    fromUser: false,
  };
}

export function MapHubPreview({ className = '' }: { className?: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  const coordsTick = useSyncExternalStore(
    subscribePassiveFindMeCoords,
    getFindMeCoordsSnapshot,
    getFindMeCoordsSnapshot,
  );

  const center = useMemo(() => resolvePreviewCenter(), [coordsTick]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !containerRef.current) return;
    let cancelled = false;
    let map: import('mapbox-gl').Map | null = null;
    let marker: import('mapbox-gl').Marker | null = null;

    void (async () => {
      const mapbox = await loadMapboxGL();
      if (cancelled || !containerRef.current) return;
      mapbox.accessToken = token;
      map = new mapbox.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STYLES.streets,
        center: [center.lng, center.lat],
        zoom: center.fromUser ? 13.2 : 11.5,
        pitch: 28,
        bearing: -12,
        interactive: false,
        attributionControl: false,
      });
      map.once('load', () => {
        if (!map || cancelled) return;
        map.resize();
        setReady(true);
      });
      if (center.fromUser) {
        marker = new mapbox.Marker({ color: '#2a6f8f' })
          .setLngLat([center.lng, center.lat])
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      marker?.remove();
      map?.remove();
    };
  }, [token, center.lng, center.lat, center.fromUser]);

  if (!token) return null;

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div
        className="relative w-full overflow-hidden bg-black/[0.04]"
        style={{ height: 'min(52vw, 320px)', minHeight: 220 }}
      >
        {/* Canvas taller than the frame — bottom 2rem is clipped */}
        <div
          ref={containerRef}
          className="absolute inset-x-0 top-0 w-full"
          style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
        />
        {!ready ? (
          <div
            className="pointer-events-none absolute inset-0 animate-pulse bg-black/[0.04]"
            aria-hidden
          />
        ) : null}

        {/* Soft fade so the CTA reads clearly over the basemap */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#f7f5f1]/95 via-[#f7f5f1]/55 to-transparent"
        />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-3.5 pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
              Minnesota map
            </p>
            <p className="mt-0.5 truncate text-[14px] font-semibold text-foreground">
              {center.fromUser ? 'Near you' : 'Twin Cities'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(GAME_PATH)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lake-blue px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(42,111,143,0.35)] transition active:scale-[0.98]"
          >
            <IconMapPin className="h-4 w-4" />
            Open game map
          </button>
        </div>
      </div>
    </div>
  );
}
