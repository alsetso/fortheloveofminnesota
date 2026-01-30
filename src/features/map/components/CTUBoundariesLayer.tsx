'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getCTUBoundaries, hasCTUCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

interface CTUBoundariesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onCTUHover?: (ctu: any) => void;
  /** When set, layer only visible at zoom >= this (e.g. 4). */
  minzoom?: number;
  /** When set, layer only visible at zoom < this (e.g. 10). */
  maxzoom?: number;
  /** Called when load starts (true) or finishes (false). For Review accordion on /live. */
  onLoadChange?: (loading: boolean) => void;
  /** Called when boundary is clicked (e.g. /live footer). */
  onBoundarySelect?: (item: { layer: 'state' | 'county' | 'ctu'; id: string; name: string; lat: number; lng: number; details?: Record<string, unknown> }) => void;
}

/**
 * CTU Boundaries Layer Component
 * Renders Minnesota City, Township, and Unorganized Territory boundaries on the map
 */
export default function CTUBoundariesLayer({
  map,
  mapLoaded,
  visible,
  onCTUHover,
  minzoom,
  maxzoom,
  onLoadChange,
  onBoundarySelect,
}: CTUBoundariesLayerProps) {
  const [ctus, setCTUs] = useState<any[]>([]);
  const [hoveredCTU, setHoveredCTU] = useState<any | null>(null);
  const isAddingLayersRef = useRef(false);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  // Fetch CTU boundaries (cached; one API call per session)
  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasCTUCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getCTUBoundaries()
      .then((data) => {
        if (!cancelled) setCTUs(data);
      })
      .catch((error) => {
        if (!cancelled) console.error('[CTUBoundariesLayer] Failed to fetch CTU boundaries:', error);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Render CTU boundaries on map
  useEffect(() => {
    if (!map || !mapLoaded || ctus.length === 0 || !visible) {
      // Clean up if hiding CTUs
      if (!visible && map) {
        const mapboxMap = map as any;
        const sourceId = 'ctu-boundaries-source';
        const fillLayerId = 'ctu-boundaries-fill';
        const outlineLayerId = 'ctu-boundaries-outline';
        const highlightFillLayerId = 'ctu-boundaries-highlight-fill';
        const highlightOutlineLayerId = 'ctu-boundaries-highlight-outline';
        const highlightSourceId = 'ctu-boundaries-highlight-source';

        try {
          if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
          if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
          if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
          if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
          if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
          if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return;
    }

    if (isAddingLayersRef.current) return;
    isAddingLayersRef.current = true;

    const mapboxMap = map as any;
    const sourceId = 'ctu-boundaries-source';
    const fillLayerId = 'ctu-boundaries-fill';
    const outlineLayerId = 'ctu-boundaries-outline';
    const highlightFillLayerId = 'ctu-boundaries-highlight-fill';
    const highlightOutlineLayerId = 'ctu-boundaries-highlight-outline';
    const highlightSourceId = 'ctu-boundaries-highlight-source';

    // Combine all CTU geometries into a single FeatureCollection
    const allFeatures: any[] = [];
    ctus.forEach((ctu) => {
      const featureCollection = ctu.geometry;
      if (featureCollection && featureCollection.type === 'FeatureCollection' && featureCollection.features) {
        featureCollection.features.forEach((feature: any) => {
          // Add CTU metadata to each feature's properties
          allFeatures.push({
            ...feature,
            properties: {
              ...feature.properties,
              ctu_id: ctu.id,
              ctu_class: ctu.ctu_class,
              feature_name: ctu.feature_name,
              gnis_feature_id: ctu.gnis_feature_id,
              county_name: ctu.county_name,
              county_code: ctu.county_code,
              population: ctu.population,
              acres: ctu.acres,
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
    } catch (e) {
      // Ignore errors if layers don't exist
    }

    // Add source with combined FeatureCollection
    mapboxMap.addSource(sourceId, {
      type: 'geojson',
      data: combinedFeatureCollection,
    });

    // Color scheme by CTU class
    const colorMap = {
      'CITY': '#4A90E2',           // Blue
      'TOWNSHIP': '#7ED321',       // Green
      'UNORGANIZED TERRITORY': '#F5A623', // Orange
    };

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
        'fill-color': [
          'match',
          ['get', 'ctu_class'],
          'CITY', colorMap['CITY'],
          'TOWNSHIP', colorMap['TOWNSHIP'],
          'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
          '#888888', // Default gray
        ],
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
        'line-color': [
          'match',
          ['get', 'ctu_class'],
          'CITY', colorMap['CITY'],
          'TOWNSHIP', colorMap['TOWNSHIP'],
          'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
          '#888888', // Default gray
        ],
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
          'fill-color': [
            'match',
            ['get', 'ctu_class'],
            'CITY', colorMap['CITY'],
            'TOWNSHIP', colorMap['TOWNSHIP'],
            'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
            '#888888',
          ],
          'fill-opacity': 0.4, // More opaque than regular CTUs
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
          'line-color': [
            'match',
            ['get', 'ctu_class'],
            'CITY', colorMap['CITY'],
            'TOWNSHIP', colorMap['TOWNSHIP'],
            'UNORGANIZED TERRITORY', colorMap['UNORGANIZED TERRITORY'],
            '#888888',
          ],
          'line-width': 2,
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

        // Highlight this specific CTU feature
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [feature],
          });
        }

        // Fade all other CTUs
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.05);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.2);
          }
        } catch (e) {
          // Ignore errors
        }

        // Find the CTU record for this feature
        const ctuId = properties.ctu_id;
        const ctu = ctus.find((c) => c.id === ctuId);

        if (ctu) {
          const hoveredCTUData = {
            ...ctu,
            hoveredFeature: {
              properties: properties,
              geometry: feature.geometry,
            },
          };
          setHoveredCTU(hoveredCTUData);
          if (onCTUHover) {
            onCTUHover(hoveredCTUData);
          }
        }
      }
    };

    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor = '';
      setHoveredCTU(null);
      if (onCTUHover) {
        onCTUHover(null);
      }

      // Clear highlight
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      // Restore all CTUs to normal opacity
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
      const properties = feature.properties || {};
      const id = (properties.ctu_id as string) ?? '';
      const name = (properties.feature_name as string) || 'CTU';
      const ctuRecord = ctus.find((c) => c.id === id);
      const geom = feature.geometry as any;
      const c = geom?.coordinates;
      const ring = c?.[0]?.[0] && typeof c[0][0][0] === 'number' ? c[0][0] : c?.[0];
      const pt = ring?.[0];
      if (!Array.isArray(pt) || pt.length < 2) return;
      const [lng, lat] = pt;
      const details = ctuRecord ? { ...ctuRecord, geometry: undefined } : undefined;
      const item = { layer: 'ctu' as const, id: id || (ctuRecord?.id ?? ''), name, lat, lng, details };
      if (process.env.NODE_ENV === 'development') {
        console.debug('[LiveBoundary] ctu click', { layer: item.layer, id: item.id, name: item.name, hasOnBoundarySelect: !!onBoundarySelect });
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
  }, [map, mapLoaded, ctus, visible, onCTUHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  return null; // This component doesn't render any UI
}

