'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getSchoolDistricts, hasSchoolDistrictsCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

const SOURCE_ID = 'school-districts-source';
const FILL_LAYER_ID = 'school-districts-fill';
const OUTLINE_LAYER_ID = 'school-districts-outline';
const HIGHLIGHT_SOURCE_ID = 'school-districts-highlight-source';
const HIGHLIGHT_FILL_LAYER_ID = 'school-districts-highlight-fill';
const HIGHLIGHT_OUTLINE_LAYER_ID = 'school-districts-highlight-outline';
const FILL_COLOR = '#6366f1';

interface SchoolDistrictsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  hoveredFeature?: { properties?: Record<string, unknown>; geometry?: unknown } | null;
  onLoadChange?: (loading: boolean) => void;
}

export default function SchoolDistrictsLayer({
  map,
  mapLoaded,
  visible,
  selectedId,
  focusOnlyId,
  hoveredFeature: _hoveredFeature,
  onLoadChange,
}: SchoolDistrictsLayerProps) {
  const [districts, setDistricts] = useState<Array<{ id: string; name?: string | null; short_name?: string | null; geometry?: GeoJSON.Geometry | null }>>([]);
  const isAddingLayersRef = useRef(false);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasSchoolDistrictsCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getSchoolDistricts()
      .then((data) => {
        if (!cancelled) setDistricts(data);
      })
      .catch((err) => {
        if (!cancelled) console.error('[SchoolDistrictsLayer] Failed to fetch:', err);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!map || !mapLoaded || districts.length === 0 || !visible) {
      if (!visible && map) {
        const m = map as unknown as { getLayer: (id: string) => unknown; getSource: (id: string) => unknown; removeLayer: (id: string) => void; removeSource: (id: string) => void };
        [FILL_LAYER_ID, OUTLINE_LAYER_ID, HIGHLIGHT_FILL_LAYER_ID, HIGHLIGHT_OUTLINE_LAYER_ID].forEach((id) => {
          try { if (m.getLayer(id)) m.removeLayer(id); } catch {}
        });
        [SOURCE_ID, HIGHLIGHT_SOURCE_ID].forEach((id) => {
          try { if (m.getSource(id)) m.removeSource(id); } catch {}
        });
      }
      return;
    }

    if (isAddingLayersRef.current) return;
    isAddingLayersRef.current = true;

    const mapboxMap = map as unknown as {
      addSource: (id: string, opts: { type: string; data: GeoJSON.FeatureCollection }) => void;
      addLayer: (opts: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
      setPaintProperty: (layerId: string, name: string, value: unknown) => void;
    };

    const toRender = focusOnlyId
      ? districts.filter((d) => d.id === focusOnlyId)
      : districts;

    const features: GeoJSON.Feature[] = toRender
      .filter((d) => d.geometry)
      .map((d) => ({
        type: 'Feature' as const,
        geometry: d.geometry as GeoJSON.Geometry,
        properties: {
          id: d.id,
          name: d.name ?? d.short_name ?? 'School District',
          short_name: d.short_name ?? null,
        },
      }));

    if (features.length === 0) {
      isAddingLayersRef.current = false;
      return;
    }

    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    try {
      if (mapboxMap.getLayer(FILL_LAYER_ID)) mapboxMap.removeLayer(FILL_LAYER_ID);
      if (mapboxMap.getLayer(OUTLINE_LAYER_ID)) mapboxMap.removeLayer(OUTLINE_LAYER_ID);
      if (mapboxMap.getLayer(HIGHLIGHT_FILL_LAYER_ID)) mapboxMap.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
      if (mapboxMap.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) mapboxMap.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID);
      if (mapboxMap.getSource(SOURCE_ID)) mapboxMap.removeSource(SOURCE_ID);
      if (mapboxMap.getSource(HIGHLIGHT_SOURCE_ID)) mapboxMap.removeSource(HIGHLIGHT_SOURCE_ID);
    } catch {}

    mapboxMap.addSource(SOURCE_ID, { type: 'geojson', data: fc });

    const beforeId = ['map-mentions-point', 'map-pins-points', 'map-areas-fill'].find((id) =>
      mapboxMap.getLayer(id)
    );

    mapboxMap.addLayer(
      {
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': FILL_COLOR, 'fill-opacity': 0.12 },
      },
      beforeId
    );
    mapboxMap.addLayer(
      {
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': FILL_COLOR, 'line-width': 1.5, 'line-opacity': 0.7 },
      },
      beforeId
    );

    if (!mapboxMap.getSource(HIGHLIGHT_SOURCE_ID)) {
      mapboxMap.addSource(HIGHLIGHT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!mapboxMap.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
      mapboxMap.addLayer(
        {
          id: HIGHLIGHT_FILL_LAYER_ID,
          type: 'fill',
          source: HIGHLIGHT_SOURCE_ID,
          paint: { 'fill-color': FILL_COLOR, 'fill-opacity': 0.35 },
        },
        beforeId
      );
    }
    if (!mapboxMap.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) {
      mapboxMap.addLayer(
        {
          id: HIGHLIGHT_OUTLINE_LAYER_ID,
          type: 'line',
          source: HIGHLIGHT_SOURCE_ID,
          paint: { 'line-color': FILL_COLOR, 'line-width': 2.5, 'line-opacity': 1 },
        },
        beforeId
      );
    }

    moveMentionsLayersToTop(mapboxMap as unknown as { getLayer: (id: string) => unknown; moveLayer: (id: string, beforeId?: string) => void });

    const highlightSource = mapboxMap.getSource(HIGHLIGHT_SOURCE_ID) as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    const selectedFeature = selectedId ? features.find((f) => (f.properties as { id?: string })?.id === selectedId) : null;
    if (highlightSource?.setData) {
      highlightSource.setData({
        type: 'FeatureCollection',
        features: selectedFeature ? [selectedFeature] : [],
      });
    }
    try {
      if (mapboxMap.getLayer(FILL_LAYER_ID)) {
        mapboxMap.setPaintProperty(
          FILL_LAYER_ID,
          'fill-opacity',
          selectedId ? ['case', ['==', ['get', 'id'], selectedId], 0.12, 0.05] : 0.12
        );
      }
      if (mapboxMap.getLayer(OUTLINE_LAYER_ID)) {
        mapboxMap.setPaintProperty(
          OUTLINE_LAYER_ID,
          'line-opacity',
          selectedId ? ['case', ['==', ['get', 'id'], selectedId], 0.7, 0.3] : 0.7
        );
      }
    } catch {}

    onLoadChangeRef.current?.(false);
    isAddingLayersRef.current = false;

    return () => {
      try {
        const m = map as unknown as { getLayer: (id: string) => unknown; getSource: (id: string) => unknown; removeLayer: (id: string) => void; removeSource: (id: string) => void };
        [FILL_LAYER_ID, OUTLINE_LAYER_ID, HIGHLIGHT_FILL_LAYER_ID, HIGHLIGHT_OUTLINE_LAYER_ID].forEach((id) => {
          if (m.getLayer(id)) m.removeLayer(id);
        });
        [SOURCE_ID, HIGHLIGHT_SOURCE_ID].forEach((id) => {
          if (m.getSource(id)) m.removeSource(id);
        });
      } catch {}
    };
  }, [map, mapLoaded, districts, visible, selectedId, focusOnlyId]);

  useEffect(() => {
    if (!map || !mapLoaded || !visible || districts.length === 0) return;
    const m = map as unknown as { getSource: (id: string) => { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined; getLayer: (id: string) => unknown; setPaintProperty: (layerId: string, name: string, value: unknown) => void };
    const highlightSource = m.getSource(HIGHLIGHT_SOURCE_ID) as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    if (!highlightSource?.setData) return;

    if (!selectedId) {
      highlightSource.setData({ type: 'FeatureCollection', features: [] });
      try {
        if (m.getLayer(FILL_LAYER_ID)) m.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0.12);
        if (m.getLayer(OUTLINE_LAYER_ID)) m.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', 0.7);
      } catch {}
      return;
    }

    const district = districts.find((d) => d.id === selectedId);
    const selectedFeature = district?.geometry
      ? ({
          type: 'Feature' as const,
          geometry: district.geometry,
          properties: { id: district.id, name: district.name ?? district.short_name ?? 'School District', short_name: district.short_name ?? null },
        } satisfies GeoJSON.Feature)
      : null;
    highlightSource.setData({
      type: 'FeatureCollection',
      features: selectedFeature ? [selectedFeature] : [],
    });
    try {
      if (m.getLayer(FILL_LAYER_ID)) m.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', ['case', ['==', ['get', 'id'], selectedId], 0.12, 0.05]);
      if (m.getLayer(OUTLINE_LAYER_ID)) m.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', ['case', ['==', ['get', 'id'], selectedId], 0.7, 0.3]);
    } catch {}
  }, [selectedId, map, mapLoaded, visible, districts]);

  return null;
}
