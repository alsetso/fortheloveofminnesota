/**
 * Object Radar layers — collectible dots (MiniMap + Object Map).
 */

import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type {
  ObjectRadarFeatureCollection,
  ObjectRadarSurface,
} from '@/features/map/game/objectRadar/types';

export const OBJECT_RADAR_SOURCE = 'object-radar-collectibles';
export const OBJECT_RADAR_HALO_LAYER = 'object-radar-collectibles-halo';
export const OBJECT_RADAR_DOT_LAYER = 'object-radar-collectibles-dot';

// ── "Other" non-collectible objects ─────────────────────────────────────────
export const OTHER_RADAR_SOURCE = 'object-radar-other';
export const OTHER_RADAR_DOT_LAYER = 'object-radar-other-dot';

/** Per-feature color from purpose / classic slug (set in loadStillOutObjects). */
const COLOR_EXPR = ['coalesce', ['get', 'color'], '#9ca3af'] as const;

export function syncObjectMarkers(
  map: MapboxMap,
  data: ObjectRadarFeatureCollection,
  surface: ObjectRadarSurface = 'object-map',
  selectedId: string | null = null,
): void {
  if (!map.getStyle()) return;

  // Dial is ~84px — dots must read clearly inside the Range disc.
  const haloR = surface === 'minimap' ? 7 : 10;
  const dotR = surface === 'minimap' ? 5 : 5;
  const haloBlur = surface === 'minimap' ? 0.15 : 0.45;
  const haloOpacity = surface === 'minimap' ? 0.55 : 0.32;

  const existing = map.getSource(OBJECT_RADAR_SOURCE) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
  } else {
    map.addSource(OBJECT_RADAR_SOURCE, {
      type: 'geojson',
      data,
      promoteId: 'id',
    });

    map.addLayer({
      id: OBJECT_RADAR_HALO_LAYER,
      type: 'circle',
      source: OBJECT_RADAR_SOURCE,
      paint: {
        'circle-radius': haloR,
        'circle-color': COLOR_EXPR as unknown as string,
        'circle-opacity': haloOpacity,
        'circle-blur': haloBlur,
      },
    });

    map.addLayer({
      id: OBJECT_RADAR_DOT_LAYER,
      type: 'circle',
      source: OBJECT_RADAR_SOURCE,
      paint: {
        'circle-radius': dotR,
        'circle-color': COLOR_EXPR as unknown as string,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#050608',
        'circle-opacity': 1,
      },
    });
  }

  // Keep dial/object-map paint in sync when relocating the shared map.
  if (map.getLayer(OBJECT_RADAR_HALO_LAYER)) {
    map.setPaintProperty(
      OBJECT_RADAR_HALO_LAYER,
      'circle-color',
      COLOR_EXPR as unknown as string,
    );
    map.setPaintProperty(OBJECT_RADAR_HALO_LAYER, 'circle-radius', [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      haloR + 3,
      haloR,
    ]);
    map.setPaintProperty(OBJECT_RADAR_HALO_LAYER, 'circle-opacity', [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      0.6,
      haloOpacity,
    ]);
    map.setPaintProperty(OBJECT_RADAR_HALO_LAYER, 'circle-blur', haloBlur);
  }
  if (map.getLayer(OBJECT_RADAR_DOT_LAYER)) {
    map.setPaintProperty(
      OBJECT_RADAR_DOT_LAYER,
      'circle-color',
      COLOR_EXPR as unknown as string,
    );
    map.setPaintProperty(OBJECT_RADAR_DOT_LAYER, 'circle-radius', [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      dotR + 2,
      dotR,
    ]);
    map.setPaintProperty(OBJECT_RADAR_DOT_LAYER, 'circle-opacity', 1);
  }

  for (const f of data.features) {
    const id = String(f.properties?.id ?? f.id ?? '');
    if (!id) continue;
    try {
      map.setFeatureState(
        { source: OBJECT_RADAR_SOURCE, id },
        { selected: id === selectedId },
      );
    } catch {
      // source not ready
    }
  }

  // Always on top of basemap labels so dial pins stay visible.
  try {
    if (map.getLayer(OBJECT_RADAR_HALO_LAYER)) {
      map.moveLayer(OBJECT_RADAR_HALO_LAYER);
    }
    if (map.getLayer(OBJECT_RADAR_DOT_LAYER)) {
      map.moveLayer(OBJECT_RADAR_DOT_LAYER);
    }
  } catch {
    /* style race */
  }
}

/**
 * Render non-collectible "other" objects as small muted grey dots.
 * A separate GL source keeps these visually subordinate to the colored
 * collectible dots. Pass an empty FeatureCollection to clear the layer.
 */
export function syncOtherObjectMarkers(
  map: MapboxMap,
  data: ObjectRadarFeatureCollection,
  surface: ObjectRadarSurface = 'object-map',
): void {
  if (!map.getStyle()) return;

  // Slightly smaller than collectibles — they're ambient context, not targets.
  const dotR = surface === 'minimap' ? 3 : 4;
  const dotOpacity = surface === 'minimap' ? 0.55 : 0.65;

  const existing = map.getSource(OTHER_RADAR_SOURCE) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
  } else {
    map.addSource(OTHER_RADAR_SOURCE, {
      type: 'geojson',
      data,
      promoteId: 'id',
    });

    map.addLayer({
      id: OTHER_RADAR_DOT_LAYER,
      type: 'circle',
      source: OTHER_RADAR_SOURCE,
      paint: {
        'circle-radius': dotR,
        'circle-color': '#9ca3af',
        'circle-opacity': dotOpacity,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#050608',
        'circle-stroke-opacity': 0.5,
      },
    });
  }

  if (map.getLayer(OTHER_RADAR_DOT_LAYER)) {
    map.setPaintProperty(OTHER_RADAR_DOT_LAYER, 'circle-radius', dotR);
    map.setPaintProperty(OTHER_RADAR_DOT_LAYER, 'circle-opacity', dotOpacity);
  }

  // Keep below the colored collectible layers so collectibles always win.
  try {
    if (map.getLayer(OTHER_RADAR_DOT_LAYER)) {
      // Move other below halo layer — insert before the halo
      if (map.getLayer(OBJECT_RADAR_HALO_LAYER)) {
        map.moveLayer(OTHER_RADAR_DOT_LAYER, OBJECT_RADAR_HALO_LAYER);
      } else {
        map.moveLayer(OTHER_RADAR_DOT_LAYER);
      }
    }
  } catch {
    /* style race */
  }
}

/** Remove the "other" objects layer and source from the map. */
export function clearOtherObjectMarkers(map: MapboxMap): void {
  try {
    if (map.getLayer(OTHER_RADAR_DOT_LAYER)) map.removeLayer(OTHER_RADAR_DOT_LAYER);
    if (map.getSource(OTHER_RADAR_SOURCE)) map.removeSource(OTHER_RADAR_SOURCE);
  } catch {
    /* map gone or style race */
  }
}

function setMapCursor(map: MapboxMap, cursor: string) {
  try {
    const canvas = map.getCanvas?.();
    if (canvas?.style) canvas.style.cursor = cursor;
  } catch {
    // Map already removed — Object Map tears down before click unbind.
  }
}

export function bindObjectMarkerClicks(
  map: MapboxMap,
  onSelect: (id: string, lngLat: { lng: number; lat: number }) => void,
  onClear: () => void,
): () => void {
  // Layer click + map click both fire — gate clear so selects stick.
  let pickedDot = false;

  const onDotClick = (e: MapMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    e.originalEvent.stopPropagation();
    const id = String(
      (f.properties as { id?: string } | null)?.id ?? f.id ?? '',
    );
    const geom = f.geometry;
    if (geom.type !== 'Point') return;
    const coords = geom.coordinates;
    if (!id || coords.length < 2) return;
    pickedDot = true;
    onSelect(id, { lng: coords[0], lat: coords[1] });
  };

  const onMapClick = () => {
    if (pickedDot) {
      pickedDot = false;
      return;
    }
    onClear();
  };

  const onEnter = () => setMapCursor(map, 'pointer');
  const onLeave = () => setMapCursor(map, '');

  map.on('click', OBJECT_RADAR_DOT_LAYER, onDotClick);
  map.on('click', OBJECT_RADAR_HALO_LAYER, onDotClick);
  map.on('click', onMapClick);
  map.on('mouseenter', OBJECT_RADAR_DOT_LAYER, onEnter);
  map.on('mouseleave', OBJECT_RADAR_DOT_LAYER, onLeave);

  return () => {
    try {
      map.off('click', OBJECT_RADAR_DOT_LAYER, onDotClick);
      map.off('click', OBJECT_RADAR_HALO_LAYER, onDotClick);
      map.off('click', onMapClick);
      map.off('mouseenter', OBJECT_RADAR_DOT_LAYER, onEnter);
      map.off('mouseleave', OBJECT_RADAR_DOT_LAYER, onLeave);
    } catch {
      /* map gone */
    }
    setMapCursor(map, '');
  };
}
