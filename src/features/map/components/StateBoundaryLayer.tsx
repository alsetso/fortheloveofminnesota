'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getStateBoundary, hasStateCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

type MapboxFeatureLike = { properties?: Record<string, unknown>; geometry?: unknown };

interface StateBoundaryLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  /** When set, parent handles interaction; layer only applies highlight */
  hoveredFeature?: MapboxFeatureLike | null;
  onStateHover?: (state: any) => void;
  /** When set, layer only visible at zoom >= this (e.g. 1). */
  minzoom?: number;
  /** When set, layer only visible below this zoom (e.g. 4 = show when zoom < 4). */
  maxzoom?: number;
  /** Override fill color (e.g. red for live map). */
  fillColor?: string;
  /** Called when load starts (true) or finishes (false). For Review accordion on /maps. */
  onLoadChange?: (loading: boolean) => void;
  /** Called when boundary is clicked (e.g. /maps footer). */
  onBoundarySelect?: (item: { layer: 'state' | 'county' | 'ctu'; id: string; name: string; lat: number; lng: number; details?: Record<string, unknown> }) => void;
}

/**
 * State Boundary Layer Component
 * Renders Minnesota state boundary on the map
 */
export default function StateBoundaryLayer({
  map,
  mapLoaded,
  visible,
  selectedId,
  focusOnlyId: _focusOnlyId,
  hoveredFeature: externalHoveredFeature,
  onStateHover,
  minzoom,
  maxzoom,
  fillColor = '#4A90E2',
  onLoadChange,
  onBoundarySelect,
}: StateBoundaryLayerProps) {
  const [stateBoundary, setStateBoundary] = useState<any | null>(null);
  const isAddingLayersRef = useRef(false);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  // Fetch state boundary (cached; one API call per session)
  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasStateCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getStateBoundary()
      .then((data) => {
        if (!cancelled) setStateBoundary(data);
      })
      .catch((error) => {
        if (!cancelled) console.error('[StateBoundaryLayer] Failed to fetch state boundary:', error);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Render state boundary on map
  useEffect(() => {
    if (!map || !mapLoaded || !stateBoundary || !visible) {
      // Clean up if hiding state boundary
      if (!visible && map) {
        const mapboxMap = map as any;
        const sourceId = 'state-boundary-source';
        const fillLayerId = 'state-boundary-fill';
        const outlineLayerId = 'state-boundary-outline';
        const highlightFillLayerId = 'state-boundary-highlight-fill';
        const highlightOutlineLayerId = 'state-boundary-highlight-outline';
        const highlightSourceId = 'state-boundary-highlight-source';

        try {
          if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
          if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
          if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
          if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
          if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
          if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
        } catch {
          // Ignore cleanup errors
        }
      }
      return;
    }

    if (isAddingLayersRef.current) return;
    isAddingLayersRef.current = true;

    const mapboxMap = map as any;
    const sourceId = 'state-boundary-source';
    const fillLayerId = 'state-boundary-fill';
    const outlineLayerId = 'state-boundary-outline';
    const highlightFillLayerId = 'state-boundary-highlight-fill';
    const highlightOutlineLayerId = 'state-boundary-highlight-outline';
    const highlightSourceId = 'state-boundary-highlight-source';

    // Use the geometry directly (it's a FeatureCollection)
    const geometry = stateBoundary.geometry;

    // Remove existing layers/sources if they exist
    try {
      if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
      if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
      if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
      if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
      if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
    } catch {
      // Ignore errors if layers don't exist
    }

    // Add source with FeatureCollection
    mapboxMap.addSource(sourceId, {
      type: 'geojson',
      data: geometry,
    });

    // Add fill layer (keep other layers on top when present)
    const beforeId = ['map-mentions-point', 'map-pins-points', 'map-areas-fill'].find((layerId) =>
      mapboxMap.getLayer(layerId)
    );

    mapboxMap.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      ...(minzoom != null && { minzoom }),
      ...(maxzoom != null && { maxzoom }),
      paint: {
        'fill-color': fillColor,
        'fill-opacity': 0.12,
      },
    }, beforeId);

    // Add outline layer (aligned with county/CTU: 1.5px, 0.7 opacity)
    mapboxMap.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      ...(minzoom != null && { minzoom }),
      ...(maxzoom != null && { maxzoom }),
      paint: {
        'line-color': fillColor,
        'line-width': 1.5,
        'line-opacity': 0.7,
      },
    }, beforeId);

    // Add highlight source (empty initially)
    if (!mapboxMap.getSource(highlightSourceId)) {
      mapboxMap.addSource(highlightSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Add highlight fill layer
    if (!mapboxMap.getLayer(highlightFillLayerId)) {
      mapboxMap.addLayer({
        id: highlightFillLayerId,
        type: 'fill',
        source: highlightSourceId,
        ...(minzoom != null && { minzoom }),
        ...(maxzoom != null && { maxzoom }),
        paint: {
          'fill-color': fillColor,
          'fill-opacity': 0.35,
        },
      }, beforeId);
    }

    // Add highlight outline layer (aligned: 2.5px)
    if (!mapboxMap.getLayer(highlightOutlineLayerId)) {
      mapboxMap.addLayer({
        id: highlightOutlineLayerId,
        type: 'line',
        source: highlightSourceId,
        ...(minzoom != null && { minzoom }),
        ...(maxzoom != null && { maxzoom }),
        paint: {
          'line-color': fillColor,
          'line-width': 2.5,
          'line-opacity': 1,
        },
      }, beforeId);
    }

    moveMentionsLayersToTop(mapboxMap);

    // Handle selection highlighting
    const updateSelection = () => {
      if (!selectedId || selectedId !== (stateBoundary as any)?.id) {
        // Clear selection highlight if not selected or ID doesn't match
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData && (!selectedId || selectedId !== (stateBoundary as any)?.id)) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
        // Restore normal opacity
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.12);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.7);
          }
        } catch (e) {
          // Ignore errors
        }
        return;
      }

      // State is selected - highlight it
      if (geometry && geometry.features && geometry.features.length > 0) {
        const selectedFeature = geometry.features[0];
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [selectedFeature],
          });
        }
        // State boundary is always fully visible when selected (no other boundaries to fade)
      }
    };

    updateSelection();

    let off: (() => void) | null = null;
    if (externalHoveredFeature === undefined && (onStateHover || onBoundarySelect)) {
      const handleMouseMove = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) {
          mapboxMap.getCanvas().style.cursor = '';
          onStateHover?.(null);
          updateSelection();
          return;
        }
        mapboxMap.getCanvas().style.cursor = 'pointer';
        const feature = features[0];
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource?.setData) highlightSource.setData({ type: 'FeatureCollection', features: [feature] });
        try {
          if (mapboxMap.getLayer(fillLayerId)) mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.05);
          if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.3);
        } catch { /* ignore */ }
        onStateHover?.(stateBoundary);
      };
      const handleMouseLeave = () => {
        mapboxMap.getCanvas().style.cursor = '';
        onStateHover?.(null);
        updateSelection();
      };
      const handleClick = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) return;
        const geom = features[0].geometry as any;
        const c = geom?.coordinates;
        const ring = c?.[0]?.[0] && typeof c[0][0][0] === 'number' ? c[0][0] : c?.[0];
        const pt = ring?.[0];
        if (!Array.isArray(pt) || pt.length < 2) return;
        const [lng, lat] = pt;
        onBoundarySelect?.({ layer: 'state', id: (stateBoundary as any)?.id ?? 'mn', name: (stateBoundary as any)?.name ?? 'Minnesota', lat, lng, details: stateBoundary ? { ...stateBoundary, geometry: undefined } : undefined });
      };
      const attach = () => {
        mapboxMap.on('mousemove', handleMouseMove);
        mapboxMap.on('mouseout', handleMouseLeave);
        mapboxMap.on('click', handleClick);
      };
      mapboxMap.once('idle', attach);
      off = () => {
        try {
          mapboxMap.off('mousemove', handleMouseMove);
          mapboxMap.off('mouseout', handleMouseLeave);
          mapboxMap.off('click', handleClick);
        } catch { /* ignore */ }
      };
    }

    onLoadChange?.(false);
    isAddingLayersRef.current = false;

    return () => {
      off?.();
      if (!map) return;
      const m = map as any;
      try {
        if (m.getLayer(fillLayerId)) m.removeLayer(fillLayerId);
        if (m.getLayer(outlineLayerId)) m.removeLayer(outlineLayerId);
        if (m.getLayer(highlightFillLayerId)) m.removeLayer(highlightFillLayerId);
        if (m.getLayer(highlightOutlineLayerId)) m.removeLayer(highlightOutlineLayerId);
        if (m.getSource(sourceId)) m.removeSource(sourceId);
        if (m.getSource(highlightSourceId)) m.removeSource(highlightSourceId);
      } catch { /* ignore */ }
    };
  }, [map, mapLoaded, stateBoundary, visible, selectedId, externalHoveredFeature, onStateHover, minzoom, maxzoom, fillColor, onLoadChange, onBoundarySelect]);

  useEffect(() => {
    if (externalHoveredFeature === undefined || !map || !mapLoaded || !visible) return;
    const mapboxMap = map as any;
    const fillLayerId = 'state-boundary-fill';
    const outlineLayerId = 'state-boundary-outline';
    const highlightSourceId = 'state-boundary-highlight-source';
    if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getSource(highlightSourceId)) return;
    const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
    if (!highlightSource?.setData) return;
    if (externalHoveredFeature) {
      highlightSource.setData({ type: 'FeatureCollection', features: [externalHoveredFeature] });
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.05);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.3);
      } catch { /* ignore */ }
    } else {
      highlightSource.setData({ type: 'FeatureCollection', features: [] });
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.12);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.7);
      } catch { /* ignore */ }
    }
  }, [map, mapLoaded, visible, externalHoveredFeature]);

  // Update selection when selectedId changes (separate effect to handle selection updates)
  useEffect(() => {
    if (!map || !mapLoaded || !visible || !stateBoundary) return;
    
    const mapboxMap = map as any;
    const highlightSourceId = 'state-boundary-highlight-source';
    const geometry = stateBoundary.geometry;

    if (!mapboxMap.getSource(highlightSourceId) || !geometry || !geometry.features) return;

    if (!selectedId || selectedId !== (stateBoundary as any)?.id) {
      // Clear selection highlight
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
      return;
    }

    // State is selected - highlight it
    const selectedFeature = geometry.features[0];
    const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
    if (highlightSource && highlightSource.setData) {
      highlightSource.setData({
        type: 'FeatureCollection',
        features: [selectedFeature],
      });
    }
  }, [selectedId, map, mapLoaded, visible, stateBoundary]);

  return null; // This component doesn't render any UI
}

