import type { Map as MapboxMap } from 'mapbox-gl';
import {
  addBuildingExtrusions,
  removeBuildingExtrusions,
} from '@/map/buildings/addBuildingExtrusions';

type StyleSnapshot = { name?: string; imports?: Array<{ url?: string }> };

/** Mapbox Standard / Standard Satellite — 3D objects via setConfigProperty. */
export function mapUsesMapboxStandard(map: MapboxMap): boolean {
  const style = map.getStyle() as StyleSnapshot | undefined;
  if (!style) return false;
  const name = (style.name ?? '').toLowerCase();
  if (name.includes('standard')) return true;
  return (
    style.imports?.some((imp) => imp.url?.toLowerCase().includes('mapbox/standard')) ??
    false
  );
}

function hasCompositeSource(map: MapboxMap): boolean {
  try {
    return Boolean(map.getSource('composite'));
  } catch {
    return false;
  }
}

function applyStandard3DBuildings(map: MapboxMap, enabled: boolean): void {
  const set = (
    map as MapboxMap & {
      setConfigProperty?: (importId: string, name: string, value: unknown) => void;
    }
  ).setConfigProperty;
  if (!set) return;

  try {
    set.call(map, 'basemap', 'show3dObjects', enabled);
    set.call(map, 'basemap', 'show3dBuildings', enabled);
    set.call(map, 'basemap', 'show3dLandmarks', enabled);
    set.call(map, 'basemap', 'show3dFacades', enabled);
  } catch {
    try {
      set.call(map, 'basemap', 'show3dObjects', enabled);
    } catch {
      /* not a Standard import */
    }
  }
}

/**
 * Extruded buildings for classic styles (outdoors) and Standard 3D objects for streets/satellite.
 * Safe after `setStyle` — waits for style load when needed.
 */
export function applyMapBuildings3D(map: MapboxMap, enabled = true): void {
  const run = () => {
    if ((map as MapboxMap & { _removed?: boolean })._removed) return;

    if (mapUsesMapboxStandard(map) || !hasCompositeSource(map)) {
      removeBuildingExtrusions(map);
      applyStandard3DBuildings(map, enabled);
      return;
    }

    if (enabled) {
      addBuildingExtrusions(map, {
        opacity: 0.82,
        minzoom: 13,
        castShadows: true,
      });
    } else {
      removeBuildingExtrusions(map);
    }
  };

  if (map.isStyleLoaded()) run();
  else map.once('style.load', run);
}
