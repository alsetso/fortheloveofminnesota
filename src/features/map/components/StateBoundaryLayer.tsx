'use client';

import { useEffect, useState, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface StateBoundaryLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onStateHover?: (state: any) => void;
}

/**
 * State Boundary Layer Component
 * Renders Minnesota state boundary on the map
 */
export default function StateBoundaryLayer({
  map,
  mapLoaded,
  visible,
  onStateHover,
}: StateBoundaryLayerProps) {
  const [stateBoundary, setStateBoundary] = useState<any | null>(null);
  const isAddingLayersRef = useRef(false);

  // Fetch state boundary
  useEffect(() => {
    if (!visible) return;

    const fetchStateBoundary = async () => {
      try {
        const response = await fetch('/api/civic/state-boundary');
        if (!response.ok) throw new Error('Failed to fetch state boundary');
        const data = await response.json();
        setStateBoundary(data);
      } catch (error) {
        console.error('[StateBoundaryLayer] Failed to fetch state boundary:', error);
      }
    };

    fetchStateBoundary();
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

    // Add fill layer (before mentions so mentions appear on top)
    const mentionsPointLayerId = 'map-mentions-point';
    const beforeId = mapboxMap.getLayer(mentionsPointLayerId) ? mentionsPointLayerId : undefined;

    mapboxMap.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#4A90E2',
        'fill-opacity': 0.1,
      },
    }, beforeId);

    // Add outline layer
    mapboxMap.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#4A90E2',
        'line-width': 2,
        'line-opacity': 0.8,
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
          'fill-color': '#4A90E2',
          'fill-opacity': 0.3,
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
          'line-color': '#4A90E2',
          'line-width': 3,
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

        // Highlight this feature
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [feature],
          });
        }

        // Fade the main boundary
        try {
          if (mapboxMap.getLayer(fillLayerId)) {
            mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.05);
          }
          if (mapboxMap.getLayer(outlineLayerId)) {
            mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.4);
          }
        } catch (e) {
          // Ignore errors
        }

        if (onStateHover) {
          onStateHover(stateBoundary);
        }
      }
    };

    const handleMouseLeave = () => {
      mapboxMap.getCanvas().style.cursor = '';
      if (onStateHover) {
        onStateHover(null);
      }

      // Clear highlight
      const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
      if (highlightSource && highlightSource.setData) {
        highlightSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }

      // Restore normal opacity
      try {
        if (mapboxMap.getLayer(fillLayerId)) {
          mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.1);
        }
        if (mapboxMap.getLayer(outlineLayerId)) {
          mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.8);
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
  }, [map, mapLoaded, stateBoundary, visible, onStateHover]);

  return null; // This component doesn't render any UI
}

