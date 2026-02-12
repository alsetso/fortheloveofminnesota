'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getCountyBoundaries, hasCountyCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

type MapboxFeatureLike = { properties?: Record<string, unknown>; geometry?: unknown };

interface CountyBoundariesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  /** When set, parent handles interaction; layer only applies highlight from this feature */
  hoveredFeature?: MapboxFeatureLike | null;
  onCountyHover?: (county: any) => void;
  minzoom?: number;
  maxzoom?: number;
  onLoadChange?: (loading: boolean) => void;
  onBoundarySelect?: (item: { layer: 'state' | 'county' | 'ctu'; id: string; name: string; lat: number; lng: number; details?: Record<string, unknown> }) => void;
}

/**
 * County Boundaries Layer Component
 * Renders Minnesota county boundaries on the map
 */
export default function CountyBoundariesLayer({
  map,
  mapLoaded,
  visible,
  selectedId,
  focusOnlyId,
  hoveredFeature: externalHoveredFeature,
  onCountyHover,
  minzoom,
  maxzoom,
  onLoadChange,
  onBoundarySelect,
}: CountyBoundariesLayerProps) {
  const [counties, setCounties] = useState<any[]>([]);
  const isAddingLayersRef = useRef(false);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  // Fetch county boundaries (cached; one API call per session)
  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasCountyCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getCountyBoundaries()
      .then((data) => {
        if (!cancelled) setCounties(data);
      })
      .catch((error) => {
        if (!cancelled) console.error('[CountyBoundariesLayer] Failed to fetch county boundaries:', error);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Render county boundaries on map
  useEffect(() => {
    if (!map || !mapLoaded || counties.length === 0 || !visible) {
      // Clean up if hiding counties
      if (!visible && map) {
        const mapboxMap = map as any;
        const sourceId = 'county-boundaries-source';
        const fillLayerId = 'county-boundaries-fill';
        const outlineLayerId = 'county-boundaries-outline';
        const highlightFillLayerId = 'county-boundaries-highlight-fill';
        const highlightOutlineLayerId = 'county-boundaries-highlight-outline';
        const highlightSourceId = 'county-boundaries-highlight-source';

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
    const sourceId = 'county-boundaries-source';
    const fillLayerId = 'county-boundaries-fill';
    const outlineLayerId = 'county-boundaries-outline';
    const highlightFillLayerId = 'county-boundaries-highlight-fill';
    const highlightOutlineLayerId = 'county-boundaries-highlight-outline';
    const highlightSourceId = 'county-boundaries-highlight-source';

    // When focusOnlyId set, show only that county
    const countiesToRender = focusOnlyId
      ? counties.filter((c) => c.id === focusOnlyId)
      : counties;
    if (countiesToRender.length === 0) {
      isAddingLayersRef.current = false;
      return;
    }

    // Combine all county geometries into a single FeatureCollection
    const allFeatures: any[] = [];
    countiesToRender.forEach((county) => {
      const featureCollection = county.geometry;
      if (featureCollection && featureCollection.type === 'FeatureCollection' && featureCollection.features) {
        featureCollection.features.forEach((feature: any) => {
          // Add county metadata to each feature's properties
          allFeatures.push({
            ...feature,
            properties: {
              ...feature.properties,
              county_id: county.id,
              county_name: county.county_name,
              county_code: county.county_code,
              county_gnis_feature_id: county.county_gnis_feature_id,
            },
          });
        });
      }
    });

    const combinedFeatureCollection = {
      type: 'FeatureCollection',
      features: allFeatures,
    };

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

    // Add source with combined FeatureCollection
    mapboxMap.addSource(sourceId, {
      type: 'geojson',
      data: combinedFeatureCollection,
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
        'fill-color': '#7ED321',
        'fill-opacity': 0.12,
      },
    }, beforeId);

    // Add outline layer
    mapboxMap.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      ...(minzoom != null && { minzoom }),
      ...(maxzoom != null && { maxzoom }),
      paint: {
        'line-color': '#7ED321',
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
          'fill-color': '#7ED321',
          'fill-opacity': 0.35,
        },
      }, beforeId);
    }

    // Add highlight outline layer
    if (!mapboxMap.getLayer(highlightOutlineLayerId)) {
      mapboxMap.addLayer({
        id: highlightOutlineLayerId,
        type: 'line',
        source: highlightSourceId,
        ...(minzoom != null && { minzoom }),
        ...(maxzoom != null && { maxzoom }),
        paint: {
          'line-color': '#7ED321',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      }, beforeId);
    }

    moveMentionsLayersToTop(mapboxMap);

    // Handle selection highlighting
    const updateSelection = () => {
      if (!selectedId) {
        // Clear selection highlight
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
        // Restore normal opacity for all counties
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

      // Find the selected county feature
      const selectedCounty = counties.find((c) => c.id === selectedId);
      if (!selectedCounty) return;

      const selectedFeature = allFeatures.find(
        (f) => f.properties?.county_id === selectedId
      );

      if (selectedFeature) {
        // Highlight selected feature
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [selectedFeature],
          });
        }

        // Make all other counties more transparent
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            // Use a filter expression to reduce opacity for non-selected counties
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
              'case',
              ['==', ['get', 'county_id'], selectedId],
              0.12, // Selected county stays normal
              0.05, // Other counties become more transparent
            ]);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
              'case',
              ['==', ['get', 'county_id'], selectedId],
              0.7, // Selected county stays normal
              0.3, // Other counties become more transparent
            ]);
          }
        } catch (e) {
          // Ignore errors
        }
      }
    };

    // Initial selection update
    updateSelection();

    let off: (() => void) | null = null;
    if (externalHoveredFeature === undefined && (onCountyHover || onBoundarySelect)) {
      const handleMouseMove = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) {
          mapboxMap.getCanvas().style.cursor = '';
          onCountyHover?.(null);
          updateSelection();
          return;
        }
        mapboxMap.getCanvas().style.cursor = 'pointer';
        const feature = features[0];
        const props = feature.properties || {};
        const hoveredCountyId = props.county_id;
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource?.setData) highlightSource.setData({ type: 'FeatureCollection', features: [feature] });
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
              'case', ['==', ['get', 'county_id'], hoveredCountyId], 0.12,
              ['==', ['get', 'county_id'], selectedId || ''], 0.12, 0.05,
            ]);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
              'case', ['==', ['get', 'county_id'], hoveredCountyId], 0.7,
              ['==', ['get', 'county_id'], selectedId || ''], 0.7, 0.3,
            ]);
          }
        } catch { /* ignore */ }
        const county = counties.find((c) => String(c.id) === String(hoveredCountyId));
        const data = county
          ? { ...county, hoveredFeature: { properties: props, geometry: feature.geometry } }
          : { id: String(hoveredCountyId ?? ''), county_name: (props.county_name as string) || 'County', hoveredFeature: { properties: props, geometry: feature.geometry } };
        onCountyHover?.(data);
      };
      const handleMouseLeave = () => {
        mapboxMap.getCanvas().style.cursor = '';
        onCountyHover?.(null);
        updateSelection();
      };
      const handleClick = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) return;
        const feature = features[0];
        const props = feature.properties || {};
        const id = (props.county_id as string) ?? '';
        const name = (props.county_name as string) || 'County';
        const countyRecord = counties.find((c) => String(c.id) === String(id));
        const geom = feature.geometry as any;
        const c = geom?.coordinates;
        const ring = c?.[0]?.[0] && typeof c[0][0][0] === 'number' ? c[0][0] : c?.[0];
        const pt = ring?.[0];
        if (!Array.isArray(pt) || pt.length < 2) return;
        const [lng, lat] = pt;
        const details = countyRecord ? { ...countyRecord, geometry: undefined } : undefined;
        onBoundarySelect?.({ layer: 'county', id: id || (countyRecord?.id ?? ''), name, lat, lng, details });
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
  }, [map, mapLoaded, counties, visible, selectedId, focusOnlyId, externalHoveredFeature, onCountyHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  // Apply highlight when parent passes hoveredFeature (Explore unified interaction)
  useEffect(() => {
    if (externalHoveredFeature === undefined || !map || !mapLoaded || !visible) return;
    const mapboxMap = map as any;
    const fillLayerId = 'county-boundaries-fill';
    const outlineLayerId = 'county-boundaries-outline';
    const highlightSourceId = 'county-boundaries-highlight-source';
    if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getSource(highlightSourceId)) return;

    const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
    if (!highlightSource?.setData) return;

    if (externalHoveredFeature) {
      const f = externalHoveredFeature as { properties?: Record<string, unknown>; geometry?: unknown };
      highlightSource.setData({ type: 'FeatureCollection', features: [f] });
      const hid = f.properties?.county_id;
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
            'case', ['==', ['get', 'county_id'], hid], 0.12,
            ['==', ['get', 'county_id'], selectedId || ''], 0.12, 0.05,
          ]);
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
            'case', ['==', ['get', 'county_id'], hid], 0.7,
            ['==', ['get', 'county_id'], selectedId || ''], 0.7, 0.3,
          ]);
        }
      } catch { /* ignore */ }
    } else {
      highlightSource.setData({ type: 'FeatureCollection', features: [] });
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.12);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.7);
      } catch { /* ignore */ }
    }
  }, [map, mapLoaded, visible, externalHoveredFeature, selectedId]);

  // Update selection when selectedId changes (separate effect to handle selection updates)
  useEffect(() => {
    if (!map || !mapLoaded || !visible || counties.length === 0) return;
    
    const mapboxMap = map as any;
    const sourceId = 'county-boundaries-source';
    const fillLayerId = 'county-boundaries-fill';
    const outlineLayerId = 'county-boundaries-outline';
    const highlightSourceId = 'county-boundaries-highlight-source';

    if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getSource(sourceId)) return;

    // Get all features from source
    const source = mapboxMap.getSource(sourceId) as any;
    if (!source || !source._data) return;
    
    const allFeatures = source._data.features || [];

    if (!selectedId) {
      // Clear selection highlight
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
      // Restore normal opacity for all counties
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

    // Find the selected county feature
    const selectedFeature = allFeatures.find(
      (f: any) => f.properties?.county_id === selectedId
    );

    if (selectedFeature) {
      // Highlight selected feature
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [selectedFeature],
        });
      }

      // Make all other counties more transparent
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
            'case',
            ['==', ['get', 'county_id'], selectedId],
            0.12, // Selected county stays normal
            0.05, // Other counties become more transparent
          ]);
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
            'case',
            ['==', ['get', 'county_id'], selectedId],
            0.7, // Selected county stays normal
            0.3, // Other counties become more transparent
          ]);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }, [selectedId, map, mapLoaded, visible, counties]);

  return null; // This component doesn't render any UI
}

