'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getCountyBoundaries, hasCountyCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

interface CountyBoundariesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onCountyHover?: (county: any) => void;
  /** When set, layer only visible at zoom >= this (e.g. 4). */
  minzoom?: number;
  /** When set, layer only visible at zoom < this (e.g. 8). */
  maxzoom?: number;
  /** Called when load starts (true) or finishes (false). For Review accordion on /live. */
  onLoadChange?: (loading: boolean) => void;
  /** Called when boundary is clicked (e.g. /live footer). */
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

    // Combine all county geometries into a single FeatureCollection
    const allFeatures: any[] = [];
    counties.forEach((county) => {
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

    // Add hover handlers
    const handleMouseMove = (e: any) => {
      mapboxMap.getCanvas().style.cursor = 'pointer';

      // Query the exact feature at the cursor position
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [fillLayerId],
      });

      if (features.length > 0) {
        const feature = features[0];
        const properties = feature.properties || {};

        // Highlight this specific county feature
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [feature],
          });
        }

        // Fade all other counties
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.05);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.3);
          }
        } catch (e) {
          // Ignore errors
        }

        // Find the county record for this feature
        const countyId = properties.county_id;
        const county = counties.find((c) => c.id === countyId);

        if (county) {
          const hoveredCountyData = {
            ...county,
            hoveredFeature: {
              properties: properties,
              geometry: feature.geometry,
            },
          };
          if (onCountyHover) {
            onCountyHover(hoveredCountyData);
          }
        }
      }
    };

    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor = '';
      if (onCountyHover) {
        onCountyHover(null);
      }

      // Clear highlight
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      // Restore all counties to normal opacity
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
    };

    // Click: update footer/selection only (no map popup).
    const handleClick = (e: any) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
      if (features.length === 0) return;
      const feature = features[0];
      const props = feature.properties || {};
      const id = (props.county_id as string) ?? '';
      const name = (props.county_name as string) || 'County';
      const countyRecord = counties.find((c) => c.id === id);
      const geom = feature.geometry as any;
      const c = geom?.coordinates;
      const ring = c?.[0]?.[0] && typeof c[0][0][0] === 'number' ? c[0][0] : c?.[0];
      const pt = ring?.[0];
      if (!Array.isArray(pt) || pt.length < 2) return;
      const [lng, lat] = pt;
      const details = countyRecord ? { ...countyRecord, geometry: undefined } : undefined;
      const item = { layer: 'county' as const, id: id || (countyRecord?.id ?? ''), name, lat, lng, details };
      if (process.env.NODE_ENV === 'development') {
        console.debug('[LiveBoundary] county click', { layer: item.layer, id: item.id, name: item.name, hasOnBoundarySelect: !!onBoundarySelect });
      }
      onBoundarySelect?.(item);
    };

    mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
    mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);
    mapboxMap.on('click', fillLayerId, handleClick);

    onLoadChange?.(false);
    isAddingLayersRef.current = false;

    // Cleanup function
    return () => {
      if (!map) return;
      const mapboxMap = map as any;

      try {
        mapboxMap.off('mousemove', fillLayerId);
        mapboxMap.off('mouseleave', fillLayerId);
        mapboxMap.off('click', fillLayerId, handleClick);

        // Remove layers and sources
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
        if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [map, mapLoaded, counties, visible, onCountyHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  return null; // This component doesn't render any UI
}

