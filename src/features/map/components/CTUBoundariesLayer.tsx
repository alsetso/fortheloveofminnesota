'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getCTUBoundaries, hasCTUCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

type MapboxFeatureLike = { properties?: Record<string, unknown>; geometry?: unknown; layer?: { id?: string } };

interface CTUBoundariesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  /** When set (e.g. county detail overlay), fetch only CTUs in this county */
  parentCountyName?: string;
  /** When set, parent handles interaction; layer only applies highlight */
  hoveredFeature?: MapboxFeatureLike | null;
  onCTUHover?: (ctu: any) => void;
  /** When set, layer only visible at zoom >= this (e.g. 4). */
  minzoom?: number;
  /** When set, layer only visible at zoom < this (e.g. 10). */
  maxzoom?: number;
  /** Called when load starts (true) or finishes (false). For Review accordion on /maps. */
  onLoadChange?: (loading: boolean) => void;
  /** Called when boundary is clicked (e.g. /maps footer). */
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
  selectedId,
  focusOnlyId,
  parentCountyName,
  hoveredFeature: externalHoveredFeature,
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

  // Fetch CTU boundaries: full list from cache, or county-filtered from API
  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }

    let cancelled = false;
    if (parentCountyName) {
      onLoadChangeRef.current?.(true);
      const name = String(parentCountyName).trim().replace(/\s+County$/i, '');
      fetch(`/api/civic/ctu-boundaries?county_name=${encodeURIComponent(name)}&limit=3000`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (cancelled) return;
          if (data && typeof data === 'object' && 'error' in data) return setCTUs([]);
          const list = Array.isArray(data) ? data : [];
          setCTUs(list);
        })
        .catch((err) => {
          if (!cancelled) console.error('[CTUBoundariesLayer] Failed to fetch CTU by county:', err);
        })
        .finally(() => {
          if (!cancelled) onLoadChangeRef.current?.(false);
        });
    } else {
      const loading = !hasCTUCached();
      if (loading) onLoadChangeRef.current?.(true);
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
    }
    return () => {
      cancelled = true;
    };
  }, [visible, parentCountyName]);

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
        isAddingLayersRef.current = false;
      }
      return;
    }

    const mapboxMap = map as any;
    const sourceId = 'ctu-boundaries-source';
    const fillLayerId = 'ctu-boundaries-fill';
    const outlineLayerId = 'ctu-boundaries-outline';
    const highlightFillLayerId = 'ctu-boundaries-highlight-fill';
    const highlightOutlineLayerId = 'ctu-boundaries-highlight-outline';
    const highlightSourceId = 'ctu-boundaries-highlight-source';

    const ctusToRender = parentCountyName
      ? ctus
      : focusOnlyId
        ? ctus.filter((c) => c.id === focusOnlyId)
        : ctus;
    if (ctusToRender.length === 0) {
      isAddingLayersRef.current = false;
      return;
    }

    const layerExists = mapboxMap.getLayer(fillLayerId);
    const sourceExists = mapboxMap.getSource(sourceId);
    if (layerExists && sourceExists) {
      try {
        const allFeatures: any[] = [];
        ctusToRender.forEach((ctu) => {
          const featureCollection = ctu.geometry;
          if (featureCollection && featureCollection.type === 'FeatureCollection' && featureCollection.features) {
            featureCollection.features.forEach((feature: any) => {
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
        
        const source = mapboxMap.getSource(sourceId) as any;
        if (source && source.setData) {
          source.setData(combinedFeatureCollection);
          // Early return to prevent re-adding layers
          return;
        }
      } catch (e) {
        // If update fails, fall through to re-add layers
        console.warn('[CTUBoundariesLayer] Failed to update existing source, will re-add layers:', e);
      }
    }

    if (isAddingLayersRef.current) return;
    isAddingLayersRef.current = true;

    // Combine all CTU geometries into a single FeatureCollection
    const allFeatures: any[] = [];
    ctusToRender.forEach((ctu) => {
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

    try {
      if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
      if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
      if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
      if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
      if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);

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
    } catch (e) {
      isAddingLayersRef.current = false;
      return;
    }

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
        // Restore normal opacity for all CTUs
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

      // Find the selected CTU feature
      const selectedFeature = allFeatures.find(
        (f) => f.properties?.ctu_id === selectedId
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

        // Make all other CTUs more transparent
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
              'case',
              ['==', ['get', 'ctu_id'], selectedId],
              0.12, // Selected CTU stays normal
              0.05, // Other CTUs become more transparent
            ]);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
              'case',
              ['==', ['get', 'ctu_id'], selectedId],
              0.7, // Selected CTU stays normal
              0.3, // Other CTUs become more transparent
            ]);
          }
        } catch (e) {
          // Ignore errors
        }
      }
    };

    updateSelection();

    let off: (() => void) | null = null;
    if (externalHoveredFeature === undefined && (onCTUHover || onBoundarySelect)) {
      const handleMouseMove = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) {
          mapboxMap.getCanvas().style.cursor = '';
          setHoveredCTU(null);
          onCTUHover?.(null);
          updateSelection();
          return;
        }
        mapboxMap.getCanvas().style.cursor = 'pointer';
        const feature = features[0];
        const props = feature.properties || {};
        const hid = props.ctu_id;
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource?.setData) highlightSource.setData({ type: 'FeatureCollection', features: [feature] });
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
              'case', ['==', ['get', 'ctu_id'], hid], 0.12, ['==', ['get', 'ctu_id'], selectedId || ''], 0.12, 0.05,
            ]);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
              'case', ['==', ['get', 'ctu_id'], hid], 0.7, ['==', ['get', 'ctu_id'], selectedId || ''], 0.7, 0.3,
            ]);
          }
        } catch { /* ignore */ }
        const ctu = ctus.find((c) => String(c.id) === String(hid));
        const data = ctu ? { ...ctu, hoveredFeature: { properties: props, geometry: feature.geometry } } : { id: String(hid ?? ''), feature_name: (props.feature_name as string) || 'CTU', hoveredFeature: { properties: props, geometry: feature.geometry } };
        setHoveredCTU(data);
        onCTUHover?.(data);
      };
      const handleMouseLeave = () => {
        mapboxMap.getCanvas().style.cursor = '';
        setHoveredCTU(null);
        onCTUHover?.(null);
        updateSelection();
      };
      const handleClick = (e: any) => {
        const features = mapboxMap.queryRenderedFeatures(e.point, { layers: [fillLayerId] });
        if (features.length === 0) return;
        const feature = features[0];
        const props = feature.properties || {};
        const id = (props.ctu_id as string) ?? '';
        const name = (props.feature_name as string) || 'CTU';
        const ctuRecord = ctus.find((c) => String(c.id) === String(id));
        const geom = feature.geometry as any;
        const c = geom?.coordinates;
        const ring = c?.[0]?.[0] && typeof c[0][0][0] === 'number' ? c[0][0] : c?.[0];
        const pt = ring?.[0];
        if (!Array.isArray(pt) || pt.length < 2) return;
        const [lng, lat] = pt;
        const details = ctuRecord ? { ...ctuRecord, geometry: undefined } : undefined;
        onBoundarySelect?.({ layer: 'ctu', id: id || (ctuRecord?.id ?? ''), name, lat, lng, details });
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
  }, [map, mapLoaded, ctus, visible, selectedId, focusOnlyId, externalHoveredFeature, onCTUHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  useEffect(() => {
    if (externalHoveredFeature === undefined || !map || !mapLoaded || !visible) return;
    const mapboxMap = map as any;
    const fillLayerId = 'ctu-boundaries-fill';
    const outlineLayerId = 'ctu-boundaries-outline';
    const highlightSourceId = 'ctu-boundaries-highlight-source';
    if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getSource(highlightSourceId)) return;
    const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
    if (!highlightSource?.setData) return;
    if (externalHoveredFeature) {
      const f = externalHoveredFeature as { properties?: Record<string, unknown>; geometry?: unknown };
      highlightSource.setData({ type: 'FeatureCollection', features: [f] });
      const hid = f.properties?.ctu_id;
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
            'case', ['==', ['get', 'ctu_id'], hid], 0.12, ['==', ['get', 'ctu_id'], selectedId || ''], 0.12, 0.05,
          ]);
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
            'case', ['==', ['get', 'ctu_id'], hid], 0.7, ['==', ['get', 'ctu_id'], selectedId || ''], 0.7, 0.3,
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
    if (!map || !mapLoaded || !visible || ctus.length === 0) return;
    
    const mapboxMap = map as any;
    const sourceId = 'ctu-boundaries-source';
    const fillLayerId = 'ctu-boundaries-fill';
    const outlineLayerId = 'ctu-boundaries-outline';
    const highlightSourceId = 'ctu-boundaries-highlight-source';

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
      // Restore normal opacity for all CTUs
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

    // Find the selected CTU feature
    const selectedFeature = allFeatures.find(
      (f: any) => f.properties?.ctu_id === selectedId
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

      // Make all other CTUs more transparent
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', [
            'case',
            ['==', ['get', 'ctu_id'], selectedId],
            0.12, // Selected CTU stays normal
            0.05, // Other CTUs become more transparent
          ]);
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', [
            'case',
            ['==', ['get', 'ctu_id'], selectedId],
            0.7, // Selected CTU stays normal
            0.3, // Other CTUs become more transparent
          ]);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }, [selectedId, map, mapLoaded, visible, ctus]);

  return null; // This component doesn't render any UI
}

