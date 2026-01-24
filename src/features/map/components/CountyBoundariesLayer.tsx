'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface CountyBoundariesLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onCountyHover?: (county: any) => void;
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
}: CountyBoundariesLayerProps) {
  const [counties, setCounties] = useState<any[]>([]);
  const isAddingLayersRef = useRef(false);

  // Fetch county boundaries
  useEffect(() => {
    if (!visible) return;

    const fetchCounties = async () => {
      try {
        const response = await fetch('/api/civic/county-boundaries');
        if (!response.ok) throw new Error('Failed to fetch county boundaries');
        const data = await response.json();
        setCounties(data);
      } catch (error) {
        console.error('[CountyBoundariesLayer] Failed to fetch county boundaries:', error);
      }
    };

    fetchCounties();
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
        paint: {
          'line-color': '#7ED321',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      }, beforeId);
    }

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

    // Use mousemove on fill layer to detect hover
    mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
    mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);

    isAddingLayersRef.current = false;

    // Cleanup function
    return () => {
      if (!map) return;
      const mapboxMap = map as any;

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
    };
  }, [map, mapLoaded, counties, visible, onCountyHover]);

  return null; // This component doesn't render any UI
}

