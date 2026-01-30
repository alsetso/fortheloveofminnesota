'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { getCongressionalDistricts, hasDistrictsCached } from '@/features/map/services/liveBoundaryCache';
import { moveMentionsLayersToTop } from '@/features/map/utils/layerOrder';

export type BoundarySelectItem = {
  layer: 'state' | 'county' | 'district' | 'ctu';
  id: string;
  name: string;
  lat: number;
  lng: number;
  details?: Record<string, unknown>;
};

interface CongressionalDistrictsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onDistrictHover?: (district: any) => void;
  /** When set (e.g. /live), layer only visible at zoom >= minzoom and < maxzoom. */
  minzoom?: number;
  maxzoom?: number;
  onLoadChange?: (loading: boolean) => void;
  onBoundarySelect?: (item: BoundarySelectItem) => void;
}

/**
 * Congressional Districts Layer Component
 * Renders Minnesota congressional districts on the map with hover functionality
 */
export default function CongressionalDistrictsLayer({
  map,
  mapLoaded,
  visible,
  onDistrictHover,
  minzoom,
  maxzoom,
  onLoadChange,
  onBoundarySelect,
}: CongressionalDistrictsLayerProps) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  const isAddingLayersRef = useRef(false);
  const onLoadChangeRef = useRef(onLoadChange);
  onLoadChangeRef.current = onLoadChange;

  // Fetch congressional districts (cached; one API call per session)
  useEffect(() => {
    if (!visible) {
      onLoadChangeRef.current?.(false);
      return;
    }
    const loading = !hasDistrictsCached();
    if (loading) onLoadChangeRef.current?.(true);

    let cancelled = false;
    getCongressionalDistricts()
      .then((data) => {
        if (!cancelled) setDistricts(data);
      })
      .catch((error) => {
        if (!cancelled) console.error('[CongressionalDistrictsLayer] Failed to fetch districts:', error);
      })
      .finally(() => {
        if (!cancelled) onLoadChangeRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Render congressional districts on map
  useEffect(() => {
    if (!map || !mapLoaded || districts.length === 0 || !visible) {
      // Clean up if hiding districts
      if (!visible && map) {
        const mapboxMap = map as any;
        districts.forEach((district) => {
          const districtNum = district.district_number;
          const fillLayerId = `congressional-district-${districtNum}-fill`;
          const outlineLayerId = `congressional-district-${districtNum}-outline`;
          const sourceId = `congressional-district-${districtNum}-source`;
          const highlightFillLayerId = `congressional-district-${districtNum}-highlight-fill`;
          const highlightOutlineLayerId = `congressional-district-${districtNum}-highlight-outline`;
          const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;

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
        });
      }
      return;
    }

    if (isAddingLayersRef.current) return;
    isAddingLayersRef.current = true;

    const mapboxMap = map as any;

    // Color palette for 8 districts
    const districtColors = [
      '#FF6B6B', // District 1 - Red
      '#4ECDC4', // District 2 - Teal
      '#45B7D1', // District 3 - Blue
      '#96CEB4', // District 4 - Green
      '#FFEAA7', // District 5 - Yellow
      '#DDA15E', // District 6 - Orange
      '#BC6C25', // District 7 - Brown
      '#6C5CE7', // District 8 - Purple
    ];

    districts.forEach((district) => {
      const districtNum = district.district_number;
      const sourceId = `congressional-district-${districtNum}-source`;
      const fillLayerId = `congressional-district-${districtNum}-fill`;
      const outlineLayerId = `congressional-district-${districtNum}-outline`;
      const color = districtColors[districtNum - 1] || '#888888';

      // Remove existing layers/sources if they exist
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      } catch (e) {
        // Ignore errors if layers don't exist
      }

      // The geometry column contains a FeatureCollection
      const featureCollection = district.geometry;

      // Validate it's a FeatureCollection
      if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
        console.warn(`[CongressionalDistrictsLayer] Invalid geometry for district ${districtNum}`);
        return;
      }

      // Add source with the FeatureCollection
      mapboxMap.addSource(sourceId, {
        type: 'geojson',
        data: featureCollection,
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
          'fill-color': color,
          'fill-opacity': 0.2, // Semi-transparent
        },
      }, beforeId);

      // Add outline layer (before mentions)
      mapboxMap.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        ...(minzoom != null && { minzoom }),
        ...(maxzoom != null && { maxzoom }),
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-opacity': 0.8,
        },
      }, beforeId);

      // Create highlight source and layers for individual precinct highlighting
      const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;
      const highlightFillLayerId = `congressional-district-${districtNum}-highlight-fill`;
      const highlightOutlineLayerId = `congressional-district-${districtNum}-highlight-outline`;

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

      // Add highlight fill layer (above the regular district layers, but still below mentions)
      if (!mapboxMap.getLayer(highlightFillLayerId)) {
        mapboxMap.addLayer({
          id: highlightFillLayerId,
          type: 'fill',
          source: highlightSourceId,
          ...(minzoom != null && { minzoom }),
          ...(maxzoom != null && { maxzoom }),
          paint: {
            'fill-color': color,
            'fill-opacity': 0.5, // More opaque than regular districts
          },
        }, beforeId);
      }

      // Add highlight outline layer (below mentions)
      if (!mapboxMap.getLayer(highlightOutlineLayerId)) {
        mapboxMap.addLayer({
          id: highlightOutlineLayerId,
          type: 'line',
          source: highlightSourceId,
          ...(minzoom != null && { minzoom }),
          ...(maxzoom != null && { maxzoom }),
          paint: {
            'line-color': color,
            'line-width': 3,
            'line-opacity': 1,
          },
        }, beforeId);
      }

      // Add hover handlers - get specific feature at cursor
      const handleMouseMove = (e: any) => {
        mapboxMap.getCanvas().style.cursor = 'pointer';

        // Query the exact feature at the cursor position
        const features = mapboxMap.queryRenderedFeatures(e.point, {
          layers: [fillLayerId],
        });

        if (features.length > 0) {
          const feature = features[0];
          const properties = feature.properties || {};

          // Highlight only this specific precinct
          const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
          if (highlightSource && highlightSource.setData) {
            highlightSource.setData({
              type: 'FeatureCollection',
              features: [feature],
            });
          }

          // Fade all other districts
          districts.forEach((otherDistrict) => {
            if (otherDistrict.district_number !== districtNum) {
              const otherFillLayerId = `congressional-district-${otherDistrict.district_number}-fill`;
              const otherOutlineLayerId = `congressional-district-${otherDistrict.district_number}-outline`;

              try {
                if (mapboxMap.getLayer(otherFillLayerId)) {
                  mapboxMap.setPaintProperty(otherFillLayerId, 'fill-opacity', 0.05);
                }
                if (mapboxMap.getLayer(otherOutlineLayerId)) {
                  mapboxMap.setPaintProperty(otherOutlineLayerId, 'line-opacity', 0.2);
                }
              } catch (e) {
                // Ignore errors
              }
            } else {
              // Keep current district at normal opacity
              try {
                if (mapboxMap.getLayer(fillLayerId)) {
                  mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.2);
                }
                if (mapboxMap.getLayer(outlineLayerId)) {
                  mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.8);
                }
              } catch (e) {
                // Ignore errors
              }
            }
          });

          // Combine district info with specific feature properties
          const hoveredDistrictData = {
            ...district,
            hoveredFeature: {
              properties: properties,
              geometry: feature.geometry,
            },
          };
          setHoveredDistrict(hoveredDistrictData);
          if (onDistrictHover) {
            onDistrictHover(hoveredDistrictData);
          }
        }
      };

      const handleMouseLeave = () => {
        mapboxMap.getCanvas().style.cursor = '';
        setHoveredDistrict(null);
        if (onDistrictHover) {
          onDistrictHover(null);
        }

        // Clear highlight
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }

        // Restore all districts to normal opacity
        districts.forEach((otherDistrict) => {
          const otherFillLayerId = `congressional-district-${otherDistrict.district_number}-fill`;
          const otherOutlineLayerId = `congressional-district-${otherDistrict.district_number}-outline`;

          try {
            if (mapboxMap.getLayer(otherFillLayerId)) {
              mapboxMap.setPaintProperty(otherFillLayerId, 'fill-opacity', 0.2);
            }
            if (mapboxMap.getLayer(otherOutlineLayerId)) {
              mapboxMap.setPaintProperty(otherOutlineLayerId, 'line-opacity', 0.8);
            }
          } catch (e) {
            // Ignore errors
          }
        });
      };

      // Use mousemove and mouseleave on fill layer (same as state, county, CTU)
      mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
      mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);
    });

    // Single map-level click handler for all district layers (same pattern as state/county/CTU: one handler, query layer)
    const districtFillLayerIds = districts.map((d) => `congressional-district-${d.district_number}-fill`);
    const handleDistrictClick = (e: any) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, { layers: districtFillLayerIds });
      if (features.length === 0) return;
      const feature = features[0];
      const layerId = feature?.layer?.id;
      const match = typeof layerId === 'string' && layerId.match(/^congressional-district-(\d+)-fill$/);
      if (!match) return;
      const districtNum = parseInt(match[1], 10);
      const district = districts.find((d) => d.district_number === districtNum);
      if (!district) return;
      const lngLat = e.lngLat;
      const lng = typeof lngLat?.lng === 'number' ? lngLat.lng : (Array.isArray(lngLat) ? lngLat[0] : 0);
      const lat = typeof lngLat?.lat === 'number' ? lngLat.lat : (Array.isArray(lngLat) ? lngLat[1] : 0);
      const name = district.name ?? `Congressional District ${districtNum}`;
      const entityId = (district as { id?: string }).id ?? String(districtNum);
      const item: BoundarySelectItem = {
        layer: 'district',
        id: entityId,
        name,
        lat,
        lng,
        details: district ? { ...district, geometry: undefined } : undefined,
      };
      if (process.env.NODE_ENV === 'development') {
        console.debug('[LiveBoundary] district click', { layer: item.layer, id: item.id, name: item.name, hasOnBoundarySelect: !!onBoundarySelect });
      }
      onBoundarySelect?.(item);
    };
    mapboxMap.on('click', handleDistrictClick);

    isAddingLayersRef.current = false;

    // Cleanup function
    return () => {
      if (!map) return;
      const mapboxMap = map as any;
      try {
        mapboxMap.off('click', handleDistrictClick);
      } catch (e) {
        // ignore
      }
      districts.forEach((district) => {
        const districtNum = district.district_number;
        const fillLayerId = `congressional-district-${districtNum}-fill`;
        const outlineLayerId = `congressional-district-${districtNum}-outline`;
        const sourceId = `congressional-district-${districtNum}-source`;
        const highlightFillLayerId = `congressional-district-${districtNum}-highlight-fill`;
        const highlightOutlineLayerId = `congressional-district-${districtNum}-highlight-outline`;
        const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;

        try {
          // Remove event listeners (mousemove, mouseleave only; click is single handler above)
          mapboxMap.off('mousemove', fillLayerId);
          mapboxMap.off('mouseleave', fillLayerId);

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
      });
    };
  }, [map, mapLoaded, districts, visible, onDistrictHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  return null; // This component doesn't render any UI
}

