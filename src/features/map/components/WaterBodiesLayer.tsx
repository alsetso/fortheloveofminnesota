'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getWater, hasWaterCached } from '@/features/map/services/liveBoundaryCache';

const SOURCE_ID = 'water-boundaries-source';
const FILL_LAYER_ID = 'water-boundaries-fill';
const OUTLINE_LAYER_ID = 'water-boundaries-outline';
const HIGHLIGHT_SOURCE_ID = 'water-boundaries-highlight-source';
const HIGHLIGHT_FILL_LAYER_ID = 'water-boundaries-highlight-fill';
const HIGHLIGHT_OUTLINE_LAYER_ID = 'water-boundaries-highlight-outline';

const WATER_FILL = '#2563eb';
const WATER_FILL_OPACITY = 0.25;
const WATER_LINE = '#1d4ed8';

type WaterRecord = {
  id: string;
  name?: string | null;
  gnis_name?: string | null;
  nhd_feature_id?: string | null;
  geometry?: GeoJSON.Geometry | null;
};

interface WaterBodiesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  onLoadChange?: (loading: boolean) => void;
}

function removeLayers(map: MapboxMapInstance) {
  const m = map as unknown as {
    getLayer: (id: string) => unknown;
    getSource: (id: string) => unknown;
    removeLayer: (id: string) => void;
    removeSource: (id: string) => void;
  };
  try {
    if (m.getLayer(FILL_LAYER_ID)) m.removeLayer(FILL_LAYER_ID);
    if (m.getLayer(OUTLINE_LAYER_ID)) m.removeLayer(OUTLINE_LAYER_ID);
    if (m.getLayer(HIGHLIGHT_FILL_LAYER_ID)) m.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
    if (m.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) m.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID);
    if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    if (m.getSource(HIGHLIGHT_SOURCE_ID)) m.removeSource(HIGHLIGHT_SOURCE_ID);
  } catch {
    // ignore
  }
}

export default function WaterBodiesLayer({
  map,
  mapLoaded,
  visible,
  selectedId,
  focusOnlyId,
  onLoadChange,
}: WaterBodiesLayerProps) {
  const [waters, setWaters] = useState<WaterRecord[]>([]);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  // Cached: one fetch per session (same as other boundary layers).
  useEffect(() => {
    if (!visible) {
      setWaters([]);
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasWaterCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getWater()
      .then((data) => {
        if (!cancelled) setWaters(data);
      })
      .catch(() => {
        if (!cancelled) setWaters([]);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Draw on map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    if (!visible || waters.length === 0) {
      removeLayers(map);
      return;
    }

    const m = map as unknown as {
      addSource: (id: string, opts: { type: string; data: GeoJSON.FeatureCollection }) => void;
      addLayer: (opts: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
    };

    const toRender = focusOnlyId
      ? waters.filter((w) => w.id === focusOnlyId)
      : waters;

    const features: GeoJSON.Feature[] = toRender
      .filter((w) => w.geometry)
      .map((w) => ({
        type: 'Feature' as const,
        geometry: w.geometry as GeoJSON.Geometry,
        properties: {
          id: w.id,
          name: w.name ?? w.gnis_name ?? w.nhd_feature_id ?? 'Water body',
          water_id: w.id,
        },
      }));

    if (features.length === 0) return;

    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    removeLayers(map);

    m.addSource(SOURCE_ID, { type: 'geojson', data: fc });

    const beforeId = ['map-mentions-point', 'map-pins-points', 'map-areas-fill'].find(
      (id) => m.getLayer(id)
    );

    m.addLayer(
      {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': WATER_FILL, 'fill-opacity': WATER_FILL_OPACITY },
      },
      beforeId
    );

    m.addLayer(
      {
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': WATER_LINE, 'line-width': 0.5 },
      },
      beforeId
    );

    if (selectedId && toRender.some((w) => w.id === selectedId)) {
      const sel = toRender.find((w) => w.id === selectedId);
      if (sel?.geometry) {
        const hlFeature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: sel.geometry,
          properties: {},
        };
        m.addSource(HIGHLIGHT_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [hlFeature] },
        });
        m.addLayer(
          {
            id: HIGHLIGHT_FILL_LAYER_ID,
            type: 'fill',
            source: HIGHLIGHT_SOURCE_ID,
            paint: { 'fill-color': WATER_FILL, 'fill-opacity': 0.5 },
          },
          beforeId
        );
        m.addLayer(
          {
            id: HIGHLIGHT_OUTLINE_LAYER_ID,
            type: 'line',
            source: HIGHLIGHT_SOURCE_ID,
            paint: { 'line-color': WATER_LINE, 'line-width': 2 },
          },
          beforeId
        );
      }
    }

    return () => {
      removeLayers(map);
    };
  }, [map, mapLoaded, waters, visible, selectedId, focusOnlyId]);

  return null;
}
