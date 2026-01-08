'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CongressionalDistrictsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onDistrictHover?: (district: any) => void;
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
}: CongressionalDistrictsLayerProps) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  const isAddingLayersRef = useRef(false);

  // Fetch congressional districts
  useEffect(() => {
    if (!visible) return;

    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/civic/congressional-districts');
        if (!response.ok) throw new Error('Failed to fetch districts');
        const data = await response.json();
        setDistricts(data);
      } catch (error) {
        console.error('[CongressionalDistrictsLayer] Failed to fetch districts:', error);
      }
    };

    fetchDistricts();
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

      // Add fill layer (before mentions so mentions appear on top)
      const mentionsPointLayerId = 'map-mentions-point';
      const beforeId = mapboxMap.getLayer(mentionsPointLayerId) ? mentionsPointLayerId : undefined;
      
      mapboxMap.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
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

      // Use mousemove on fill layer to detect hover
      mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
      mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);
    });

    isAddingLayersRef.current = false;

    // Cleanup function
    return () => {
      if (!map) return;
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
          // Remove event listeners
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
  }, [map, mapLoaded, districts, visible, onDistrictHover]);

  return null; // This component doesn't render any UI
}

