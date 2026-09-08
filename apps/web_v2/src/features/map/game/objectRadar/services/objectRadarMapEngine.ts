/**
 * Object Radar — ONE Mapbox instance shared by MiniMap + Object Map.
 * A second GL map in the dial was staying black; relocating one map fixes it.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { OBJECT_RADAR_MAP_STYLE } from '@/features/map/game/objectRadar/constants';
import { darkenObjectRadarStyle } from '@/features/map/game/objectRadar/services/darkenObjectRadarStyle';
import { fitCameraToRange, fitCameraToViewportBounds } from '@/features/map/game/objectRadar/range';
import type { ObjectRadarOrigin } from '@/features/map/game/objectRadar/types';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';

let map: MapboxMap | null = null;
let shell: HTMLDivElement | null = null;
let boot: Promise<MapboxMap | null> | null = null;
let attachedHost: HTMLElement | null = null;

const readyListeners = new Set<(m: MapboxMap) => void>();

function notifyReady() {
  if (!map) return;
  for (const l of readyListeners) l(map);
}

export function subscribeObjectRadarMapReady(
  listener: (m: MapboxMap) => void,
): () => void {
  readyListeners.add(listener);
  if (map) listener(map);
  return () => readyListeners.delete(listener);
}

export function getObjectRadarMap(): MapboxMap | null {
  return map;
}

async function bootMap(): Promise<MapboxMap | null> {
  if (map) return map;
  if (!MAP_CONFIG.MAPBOX_TOKEN) return null;

  if (!shell) {
    shell = document.createElement('div');
    shell.dataset.objectRadar = 'map-shell';
    shell.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;min-width:64px;min-height:64px;';
  }

  // Park off-screen until a host attaches (keeps WebGL alive with real pixels).
  if (!shell.parentElement) {
    const park = document.createElement('div');
    park.dataset.objectRadar = 'map-park';
    park.style.cssText =
      'position:fixed;left:-200px;top:0;width:160px;height:160px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;';
    park.appendChild(shell);
    document.body.appendChild(park);
  }

  const mapbox = await loadMapboxGL();
  mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

  const instance = new mapbox.Map({
    container: shell,
    style: OBJECT_RADAR_MAP_STYLE,
    center: [MAP_CONFIG.DEFAULT_CENTER[0], MAP_CONFIG.DEFAULT_CENTER[1]],
    zoom: 16,
    pitch: 0,
    interactive: true,
    attributionControl: false,
    fadeDuration: 0,
    dragRotate: true,
    touchPitch: false,
    pitchWithRotate: false,
    antialias: true,
  });

  await new Promise<void>((resolve) => {
    if (instance.isStyleLoaded()) {
      resolve();
      return;
    }
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 10_000);
    instance.once('load', done);
  });

  hideMapboxChrome(shell);
  darkenObjectRadarStyle(instance);
  instance.resize();
  map = instance;
  notifyReady();
  return map;
}

function hideMapboxChrome(root: HTMLElement) {
  root
    .querySelectorAll(
      '.mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib, .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right',
    )
    .forEach((node) => {
      (node as HTMLElement).style.display = 'none';
    });
}

export function ensureObjectRadarMap(): Promise<MapboxMap | null> {
  if (map) return Promise.resolve(map);
  if (!boot) {
    boot = bootMap().catch((err) => {
      console.error('objectRadarMapEngine', err);
      boot = null;
      return null;
    });
  }
  return boot;
}

function ensurePark(): HTMLElement {
  let park = document.querySelector(
    '[data-object-radar="map-park"]',
  ) as HTMLElement | null;
  if (!park) {
    park = document.createElement('div');
    park.dataset.objectRadar = 'map-park';
    park.style.cssText =
      'position:fixed;left:-200px;top:0;width:160px;height:160px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;';
    document.body.appendChild(park);
  }
  return park;
}

/** Park the shell so React unmount of Object Map cannot destroy the GL map. */
export function parkObjectRadarMap(): void {
  if (!shell) return;
  const park = ensurePark();
  if (shell.parentElement !== park) park.appendChild(shell);
  attachedHost = park;
  try {
    map?.resize();
  } catch {
    /* ignore */
  }
}

/** Move the shared map shell into `host` and resize to fill it. */
export function attachObjectRadarMap(host: HTMLElement | null): void {
  if (!shell || !map || !host) return;

  if (shell.parentElement !== host) {
    const prev = shell.parentElement;
    host.appendChild(shell);
    if (
      prev?.dataset.objectRadar === 'map-park' &&
      prev.childElementCount === 0
    ) {
      prev.remove();
    }
  }

  attachedHost = host;
  hideMapboxChrome(shell);
  try {
    map.resize();
    requestAnimationFrame(() => {
      try {
        map?.resize();
        map?.triggerRepaint();
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

export function setObjectRadarMapInteractive(on: boolean): void {
  if (!map) return;
  try {
    if (on) {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      map.dragRotate.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    } else {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.dragRotate.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }
  } catch {
    /* ignore */
  }
}

export function syncObjectRadarCamera(
  origin: ObjectRadarOrigin,
  rangeM: number,
  opts?: { duration?: number; /** Bearing-only orbit tick — skip resize/darken. */ light?: boolean },
): void {
  if (!map) return;
  try {
    if (opts?.light) {
      map.jumpTo({ bearing: origin.bearing });
      return;
    }
    map.resize();
    fitCameraToRange(map, origin, rangeM, {
      bearing: origin.bearing,
      duration: opts?.duration ?? 0,
    });
    darkenObjectRadarStyle(map);
    map.triggerRepaint();
  } catch {
    /* ignore */
  }
}

/** Scout dial — top-down footprint of the main map viewport (no player range). */
export function syncObjectRadarViewportCamera(
  bounds: { west: number; south: number; east: number; north: number },
  opts?: { duration?: number },
): void {
  if (!map) return;
  try {
    map.resize();
    fitCameraToViewportBounds(map, bounds, { duration: opts?.duration ?? 0 });
    darkenObjectRadarStyle(map);
    map.triggerRepaint();
  } catch {
    /* ignore */
  }
}

export function destroyObjectRadarMap(): void {
  try {
    map?.remove();
  } catch {
    /* ignore */
  }
  map = null;
  boot = null;
  attachedHost = null;
  if (shell?.parentElement?.dataset.objectRadar === 'map-park') {
    shell.parentElement.remove();
  } else {
    shell?.remove();
  }
  shell = null;
}
