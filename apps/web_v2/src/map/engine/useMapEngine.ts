'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG, type MapStyleId } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import { isInMinnesota } from '@/map/location/device/minnesotaBounds';
import { CAPITOL_SPAWN } from '@/map/location/positionMode/positionConstants';
import { getLastKnownAvatarPosition } from '@/map/location/positionMode/positionPersistence';

export type UseMapEngineOptions = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  styleId?: MapStyleId;
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  /** Cap Mapbox maxPitch (Explore passes 0 so tilt cannot creep in). */
  maxPitch?: number;
  /** Degrees clockwise from north. */
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
  /**
   * When true, skip last-known Find Me cache and boot at DEFAULT_CENTER /
   * DEFAULT_ZOOM (or explicit center/zoom). Used by statewide atlas opens.
   */
  skipFindMeBoot?: boolean;
  restrictToMinnesota?: boolean;
  /**
   * Campaign chase — kill every camera gesture. The scout stick owns
   * the frame. Disables: drag-pan, drag-rotate, scroll/pinch zoom,
   * box zoom, double-click zoom, two-finger rotate, two-finger pitch,
   * keyboard pan.
   */
  lockCameraGestures?: boolean;
  onLoad?: (map: MapboxMap) => void;
};

/** Disable every Mapbox handler that would steal the Campaign chase cam. */
export function lockMapCameraGestures(map: MapboxMap): void {
  const disable = (handler: { disable?: () => void } | undefined) => {
    try {
      handler?.disable?.();
    } catch {
      /* handler missing on this Mapbox build */
    }
  };
  disable(map.dragPan);
  disable(map.dragRotate);
  disable(map.scrollZoom);
  disable(map.boxZoom);
  disable(map.doubleClickZoom);
  disable(map.touchZoomRotate);
  disable(map.touchPitch);
  disable(map.keyboard);
}

/**
 * Boot frame derives from the resolved avatar position — never a cached
 * viewport. Last-known avatar position (validated in-MN) at neighborhood
 * zoom; else the Capitol lawn spawn. resolvePositionMode() settles the final
 * frame beneath the loading veil, so this only has to be close, not final.
 */
function resolveBootCamera(
  center?: [number, number],
  zoom?: number,
  skipFindMeBoot?: boolean,
): { center: [number, number]; zoom: number } {
  if (center != null && zoom != null) return { center, zoom };
  if (!skipFindMeBoot) {
    const cached = getLastKnownAvatarPosition();
    if (cached && isInMinnesota(cached.lat, cached.lng)) {
      return {
        center: center ?? [cached.lng, cached.lat],
        zoom: zoom ?? MAP_CONFIG.FIND_ME_ZOOM,
      };
    }
    return {
      center: center ?? [CAPITOL_SPAWN.lng, CAPITOL_SPAWN.lat],
      zoom: zoom ?? MAP_CONFIG.FIND_ME_ZOOM,
    };
  }
  return {
    center: center ?? MAP_CONFIG.DEFAULT_CENTER,
    zoom: zoom ?? MAP_CONFIG.DEFAULT_ZOOM,
  };
}

export type MapEngineState = {
  map: MapboxMap | null;
  ready: boolean;
  error: string | null;
};

/**
 * Creates and owns one Mapbox Map instance.
 * Distilled from v1 useMapboxMap — no product controls, no layer wiring.
 */
export function useMapEngine({
  containerRef,
  styleId = 'streets',
  center,
  zoom,
  pitch = MAP_CONFIG.DEFAULT_PITCH,
  maxPitch = MAP_CONFIG.MAX_PITCH,
  bearing = 0,
  minZoom = MAP_CONFIG.MIN_ZOOM,
  maxZoom = MAP_CONFIG.MAX_ZOOM,
  skipFindMeBoot = false,
  restrictToMinnesota = true,
  lockCameraGestures = false,
  onLoad,
}: UseMapEngineOptions): MapEngineState {
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    if (!containerRef.current || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let instance: MapboxMap | null = null;

    const boot = async () => {
      if (!MAP_CONFIG.MAPBOX_TOKEN) {
        setError('Mapbox token missing (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)');
        return;
      }

      try {
        const mapbox = await loadMapboxGL();
        if (cancelled || !containerRef.current) return;

        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        const container = containerRef.current;
        await new Promise<void>((resolve) => {
          let n = 0;
          const tick = () => {
            if (!container || cancelled) {
              resolve();
              return;
            }
            if (container.offsetWidth > 0 && container.offsetHeight > 0) {
              resolve();
              return;
            }
            if (n++ > 60) {
              resolve();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        if (cancelled || !containerRef.current) return;
        if (container.innerHTML.trim()) container.innerHTML = '';

        const bootCamera = resolveBootCamera(center, zoom, skipFindMeBoot);
        const b = MAP_CONFIG.MINNESOTA_BOUNDS;
        instance = new mapbox.Map({
          container,
          style: MAP_CONFIG.STYLES[styleId],
          center: bootCamera.center,
          zoom: bootCamera.zoom,
          pitch,
          bearing,
          maxPitch,
          minZoom,
          maxZoom,
          /** Rotate + two-finger pitch when the surface allows tilt (Game). */
          dragPan: !lockCameraGestures,
          dragRotate: !lockCameraGestures && maxPitch > 0,
          scrollZoom: !lockCameraGestures,
          boxZoom: !lockCameraGestures,
          doubleClickZoom: !lockCameraGestures,
          keyboard: !lockCameraGestures,
          touchZoomRotate: !lockCameraGestures,
          pitchWithRotate: false,
          touchPitch: !lockCameraGestures && maxPitch > 0,
          ...(restrictToMinnesota
            ? {
                maxBounds: [
                  [b.west, b.south],
                  [b.east, b.north],
                ] as [[number, number], [number, number]],
              }
            : {}),
          attributionControl: true,
        });

        setMap(instance);

        if (lockCameraGestures) {
          instance.on('style.load', () => {
            if (instance) lockMapCameraGestures(instance);
          });
        }
        instance.once('load', () => {
          if (cancelled) return;
          if (lockCameraGestures && instance) lockMapCameraGestures(instance);
          setReady(true);
          if (instance) onLoadRef.current?.(instance);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to init map');
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      instance?.remove();
      setMap(null);
      setReady(false);
      startedRef.current = false;
    };
    // Mount-once for the shell foundation; style switches use setStyle later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { map, ready, error };
}
