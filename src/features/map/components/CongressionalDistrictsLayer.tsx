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

type MapboxFeatureLike = { properties?: Record<string, unknown>; geometry?: unknown; layer?: { id?: string } };

interface CongressionalDistrictsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  selectedId?: string;
  focusOnlyId?: string;
  /** When set, parent handles interaction; layer only applies highlight */
  hoveredFeature?: MapboxFeatureLike | null;
  onDistrictHover?: (district: any) => void;
  /** When set (e.g. /maps), layer only visible at zoom >= minzoom and < maxzoom. */
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
  selectedId,
  focusOnlyId,
  hoveredFeature: externalHoveredFeature,
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

    const districtsToRender = focusOnlyId
      ? districts.filter(
          (d) =>
            d.id === focusOnlyId ||
            String(d.district_number) === focusOnlyId
        )
      : districts;
    if (districtsToRender.length === 0) {
      isAddingLayersRef.current = false;
      return;
    }

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

    districtsToRender.forEach((district) => {
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

      // Handle selection highlighting for this district
      const updateDistrictSelection = () => {
        const isSelected = selectedId && (
          selectedId === String(districtNum) || 
          selectedId === (district as { id?: string }).id ||
          selectedId === district.district_number?.toString()
        );

        if (isSelected && featureCollection.features && featureCollection.features.length > 0) {
          // Highlight selected district
          const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
          if (highlightSource && highlightSource.setData) {
            highlightSource.setData({
              type: 'FeatureCollection',
              features: featureCollection.features,
            });
          }
        } else if (!selectedId) {
          // Clear highlight if no selection
          const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
          if (highlightSource && highlightSource.setData) {
            highlightSource.setData({
              type: 'FeatureCollection',
              features: [],
            });
          }
        }

        // Update opacity based on selection
        if (selectedId) {
          const isSelected = selectedId === String(districtNum) || 
                            selectedId === (district as { id?: string }).id ||
                            selectedId === district.district_number?.toString();
          
          try {
            if (mapboxMap.getLayer(fillLayerId)) {
              mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', isSelected ? 0.2 : 0.05);
            }
            if (mapboxMap.getLayer(outlineLayerId)) {
              mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', isSelected ? 0.8 : 0.2);
            }
          } catch (e) {
            // Ignore errors
          }
        } else {
          // Restore normal opacity when no selection
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
      };

      // Initial selection update
      updateDistrictSelection();

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

          // Fade all other districts (but respect selection state)
          districts.forEach((otherDistrict) => {
            if (otherDistrict.district_number !== districtNum) {
              const otherFillLayerId = `congressional-district-${otherDistrict.district_number}-fill`;
              const otherOutlineLayerId = `congressional-district-${otherDistrict.district_number}-outline`;
              const isOtherSelected = selectedId && (
                selectedId === String(otherDistrict.district_number) ||
                selectedId === (otherDistrict as { id?: string }).id ||
                selectedId === otherDistrict.district_number?.toString()
              );

              try {
                if (mapboxMap.getLayer(otherFillLayerId)) {
                  mapboxMap.setPaintProperty(otherFillLayerId, 'fill-opacity', isOtherSelected ? 0.2 : 0.05);
                }
                if (mapboxMap.getLayer(otherOutlineLayerId)) {
                  mapboxMap.setPaintProperty(otherOutlineLayerId, 'line-opacity', isOtherSelected ? 0.8 : 0.2);
                }
              } catch (e) {
                // Ignore errors
              }
            } else {
              // Keep hovered district at normal opacity
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

        // Restore selection state (or clear if no selection)
        updateDistrictSelection();
      };

      if (externalHoveredFeature === undefined) {
        mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
        mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);
      }
    });

    // Single map-level click handler for all district layers
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
    const attachedClick = externalHoveredFeature === undefined;
    if (attachedClick) {
      mapboxMap.on('click', handleDistrictClick);
    }
    isAddingLayersRef.current = false;

    return () => {
      if (!map) return;
      const mapboxMap = map as any;
      try {
        if (attachedClick) mapboxMap.off('click', handleDistrictClick);
      } catch { /* ignore */ }
      districtsToRender.forEach((district) => {
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
  }, [map, mapLoaded, districts, visible, selectedId, focusOnlyId, externalHoveredFeature, onDistrictHover, minzoom, maxzoom, onLoadChange, onBoundarySelect]);

  // Apply highlight when parent passes hoveredFeature (Explore unified interaction)
  useEffect(() => {
    if (externalHoveredFeature === undefined || !map || !mapLoaded || !visible || districts.length === 0) return;
    const mapboxMap = map as any;
    const f = externalHoveredFeature as MapboxFeatureLike;
    const layerId = f.layer?.id;
    const match = typeof layerId === 'string' && layerId.match(/^congressional-district-(\d+)-fill$/);
    if (externalHoveredFeature && match) {
      const districtNum = parseInt(match[1], 10);
      const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource?.setData) {
        highlightSource.setData({ type: 'FeatureCollection', features: [externalHoveredFeature] });
      }
      districts.forEach((d) => {
        const n = d.district_number;
        const fillId = `congressional-district-${n}-fill`;
        const outlineId = `congressional-district-${n}-outline`;
        const isHovered = n === districtNum;
        const isSelected = selectedId && (String(n) === selectedId || (d as { id?: string }).id === selectedId);
        try {
          if (mapboxMap.getLayer(fillId)) mapboxMap.setPaintProperty(fillId, 'fill-opacity', isHovered ? 0.2 : isSelected ? 0.2 : 0.05);
          if (mapboxMap.getLayer(outlineId)) mapboxMap.setPaintProperty(outlineId, 'line-opacity', isHovered ? 0.8 : isSelected ? 0.8 : 0.2);
        } catch { /* ignore */ }
      });
    } else {
      districts.forEach((d) => {
        const n = d.district_number;
        const highlightSourceId = `congressional-district-${n}-highlight-source`;
        const fillId = `congressional-district-${n}-fill`;
        const outlineId = `congressional-district-${n}-outline`;
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource?.setData) highlightSource.setData({ type: 'FeatureCollection', features: [] });
        const isSelected = selectedId && (String(n) === selectedId || (d as { id?: string }).id === selectedId);
        try {
          if (mapboxMap.getLayer(fillId)) mapboxMap.setPaintProperty(fillId, 'fill-opacity', isSelected ? 0.2 : 0.2);
          if (mapboxMap.getLayer(outlineId)) mapboxMap.setPaintProperty(outlineId, 'line-opacity', isSelected ? 0.8 : 0.8);
        } catch { /* ignore */ }
      });
    }
  }, [map, mapLoaded, visible, districts, externalHoveredFeature, selectedId]);

  // Update selection when selectedId changes (separate effect to handle selection updates)
  useEffect(() => {
    if (!map || !mapLoaded || !visible || districts.length === 0) return;
    
    const mapboxMap = map as any;

    districts.forEach((district) => {
      const districtNum = district.district_number;
      const fillLayerId = `congressional-district-${districtNum}-fill`;
      const outlineLayerId = `congressional-district-${districtNum}-outline`;
      const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;
      const sourceId = `congressional-district-${districtNum}-source`;

      if (!mapboxMap.getLayer(fillLayerId) || !mapboxMap.getSource(sourceId)) return;

      const featureCollection = district.geometry;
      if (!featureCollection || !featureCollection.features) return;

      const isSelected = selectedId && (
        selectedId === String(districtNum) ||
        selectedId === (district as { id?: string }).id ||
        selectedId === district.district_number?.toString()
      );

      if (isSelected) {
        // Highlight selected district
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: featureCollection.features,
          });
        }
      } else if (!selectedId) {
        // Clear highlight if no selection
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
      }

      // Update opacity based on selection
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', isSelected ? 0.2 : (selectedId ? 0.05 : 0.2));
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', isSelected ? 0.8 : (selectedId ? 0.2 : 0.8));
        }
      } catch (e) {
        // Ignore errors
      }
    });
  }, [selectedId, map, mapLoaded, visible, districts]);

  return null; // This component doesn't render any UI
}

