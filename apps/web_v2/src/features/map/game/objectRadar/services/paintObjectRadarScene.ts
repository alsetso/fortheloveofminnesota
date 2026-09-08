/**
 * Object Radar service — paint markers + player/range for a surface.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import {
  syncObjectMarkers,
  syncOtherObjectMarkers,
  clearOtherObjectMarkers,
} from '@/features/map/game/objectRadar/layers/objectMarkers';
import { syncSavedAddressMarkersOnRadar } from '@/features/map/game/objectRadar/layers/savedAddressMarkersOnRadar';
import { restackRadarPreviewZoneLayers } from '@/features/map/game/objectRadar/layers/zonePolygonOnRadar';
import { syncObjectRadarPlayerLayers } from '@/features/map/game/objectRadar/layers/playerLayers';
import { fitCameraToRange } from '@/features/map/game/objectRadar/range';
import { getSavedAddressPins } from '@/features/map/savedAddresses/savedAddressesStore';
import type {
  ObjectRadarFeatureCollection,
  ObjectRadarOrigin,
  ObjectRadarSurface,
} from '@/features/map/game/objectRadar/types';
import { EMPTY_OBJECT_RADAR_FC } from '@/features/map/game/objectRadar/types';

export function paintObjectRadarScene(
  map: MapboxMap,
  opts: {
    origin: ObjectRadarOrigin;
    rangeM: number;
    objects: ObjectRadarFeatureCollection;
    surface: ObjectRadarSurface;
    selectedId?: string | null;
    fit?: boolean;
    fitDuration?: number;
    /** Override range ring (default: on for object-map, off for minimap). */
    showRangeRing?: boolean;
    /**
     * Non-collectible "other" objects for the zone explore view.
     * Rendered as small grey dots below the collectible layer.
     * Pass undefined or empty to clear.
     */
    otherObjects?: ObjectRadarFeatureCollection | null;
  },
): void {
  const {
    origin,
    rangeM,
    objects,
    surface,
    selectedId = null,
    fit = false,
    fitDuration = 0,
    showRangeRing = surface === 'object-map',
    otherObjects,
  } = opts;

  // Grey "other" dots — sync when provided, clear when omitted.
  if (otherObjects && otherObjects.features.length > 0) {
    syncOtherObjectMarkers(map, otherObjects, surface);
  } else if (otherObjects !== undefined) {
    clearOtherObjectMarkers(map);
  }

  syncObjectMarkers(map, objects, surface, selectedId);
  syncSavedAddressMarkersOnRadar(map, getSavedAddressPins(), surface, origin, rangeM);
  syncObjectRadarPlayerLayers(map, origin, rangeM, {
    showRangeRing,
    showPlayerMarker: surface === 'object-map',
  });
  restackRadarPreviewZoneLayers(map);

  if (fit) {
    fitCameraToRange(map, origin, rangeM, {
      bearing: origin.bearing,
      duration: fitDuration,
    });
  }
}
