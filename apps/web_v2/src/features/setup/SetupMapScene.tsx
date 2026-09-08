'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapCanvas } from '@/components/shell/MapCanvas';
import { MapProvider, useMapBuildings3D, useMapContext, useMapEngine } from '@/map';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { CAPITOL_SPAWN } from '@/map/location/positionMode/positionConstants';

/**
 * Minnesota State Capitol — quiet cinematic backdrop for /setup.
 * No player mesh, no pair picker, no inspect framing. The form owns the flow.
 * Center is CAPITOL_SPAWN — the only place those coordinates are defined.
 */
const SCENE_CENTER: [number, number] = [CAPITOL_SPAWN.lng, CAPITOL_SPAWN.lat];
const SCENE_ZOOM = 16.4;
const SCENE_PITCH = 52;
const SCENE_BEARING = 12;

/** Strip POI / place / road / transit labels on the Capitol backdrop only. */
function hideSetupMapLabels(map: MapboxMap): void {
  const set = (
    map as MapboxMap & {
      setConfigProperty?: (importId: string, name: string, value: unknown) => void;
    }
  ).setConfigProperty;
  if (set) {
    for (const key of [
      'showPlaceLabels',
      'showPointOfInterestLabels',
      'showRoadLabels',
      'showTransitLabels',
      'showLandmarkIcons',
    ]) {
      try {
        set.call(map, 'basemap', key, false);
      } catch {
        /* classic style or unknown Standard key */
      }
    }
  }

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    try {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    } catch {
      /* style swap */
    }
  }
}

/**
 * Locked Capitol portrait behind the onboarding card.
 */
export function SetupMapScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, ready, error } = useMapEngine({
    containerRef,
    center: SCENE_CENTER,
    zoom: SCENE_ZOOM,
    pitch: SCENE_PITCH,
    bearing: SCENE_BEARING,
    maxPitch: 85,
    minZoom: 9,
    maxZoom: 22,
    skipFindMeBoot: true,
    restrictToMinnesota: false,
  });

  return (
    <div className="absolute inset-0">
      <MapProvider map={map} ready={ready}>
        <MapCanvas ref={containerRef} error={error} />
        <SetupMapLayers />
      </MapProvider>
    </div>
  );
}

function SetupMapLayers() {
  useMapBuildings3D(true);
  const { map, ready } = useMapContext();

  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;
      hideSetupMapLabels(map);
    };

    void waitForMapStyleReady(map, { timeoutMs: 8_000 })
      .then(apply)
      .catch(apply);
    map.on('style.load', apply);
    return () => {
      cancelled = true;
      map.off('style.load', apply);
    };
  }, [map, ready]);

  useEffect(() => {
    if (!map || !ready) return;
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchPitch.disable();
    map.dragRotate.enable();
    map.touchZoomRotate.enable();
    map.easeTo({
      center: SCENE_CENTER,
      zoom: SCENE_ZOOM,
      pitch: SCENE_PITCH,
      bearing: SCENE_BEARING,
      duration: 700,
      essential: true,
    });
  }, [map, ready]);

  return null;
}
