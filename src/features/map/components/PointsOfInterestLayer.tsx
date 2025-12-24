'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface PointOfInterest {
  id: string;
  name: string;
  category: string;
  emoji: string | null;
  lat: number;
  lng: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface PointsOfInterestLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible?: boolean;
}

const sourceId = 'points-of-interest';
const emojiLayerId = 'points-of-interest-emoji';
const nameLayerId = 'points-of-interest-name';

/**
 * PointsOfInterestLayer - Displays points of interest from map.points_of_interest table
 * Shows all active POIs when visible is true
 */
export default function PointsOfInterestLayer({ map, mapLoaded, visible = false }: PointsOfInterestLayerProps) {
  const poisRef = useRef<PointOfInterest[]>([]);
  const isAddingLayersRef = useRef(false);

  // Fetch POIs when visible
  useEffect(() => {
    if (!map || !mapLoaded || !visible) return;

    let mounted = true;

    const loadPOIs = async () => {
      // Prevent concurrent calls
      if (isAddingLayersRef.current) return;

      try {
        const response = await fetch('/api/points-of-interest');
        if (!response.ok) {
          console.error('[PointsOfInterestLayer] Failed to fetch POIs:', response.statusText);
          return;
        }

        const data = await response.json();
        if (!mounted) return;

        poisRef.current = data.points || [];

        // Convert to GeoJSON using lat/lng directly
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: poisRef.current.map(poi => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [poi.lng, poi.lat] as [number, number],
            },
            properties: {
              id: poi.id,
              name: poi.name,
              category: poi.category,
              emoji: poi.emoji || '📍',
              description: poi.description || '',
            },
          })),
        };

        // Log for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('[PointsOfInterestLayer] Loaded POIs:', poisRef.current.length);
        }

        isAddingLayersRef.current = true;

        // Cast to actual Mapbox Map type for methods not in interface
        const mapboxMap = map as any;

        // Check if source already exists - if so, just update the data
        try {
          const existingSource = map.getSource(sourceId);
          if (existingSource && existingSource.type === 'geojson') {
            // Update existing source data (no flash)
            existingSource.setData(geoJSON);
            isAddingLayersRef.current = false;
            return;
          }
        } catch (e) {
          // Source check failed - map may be in invalid state, continue with adding source
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PointsOfInterestLayer] Error checking existing source:', e);
          }
        }

        // Source doesn't exist - need to add source and layers
        // First, clean up any existing layers (shouldn't exist if source doesn't, but be safe)
        // IMPORTANT: Remove layers BEFORE removing source to avoid "source not found" errors
        try {
          // Remove layers first (they depend on the source)
          if (mapboxMap.getLayer(nameLayerId)) {
            try {
              mapboxMap.removeLayer(nameLayerId);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          if (mapboxMap.getLayer(emojiLayerId)) {
            try {
              mapboxMap.removeLayer(emojiLayerId);
            } catch (e) {
              // Layer may already be removed or source missing - ignore
            }
          }
          // Then remove source (only if it exists)
          if (mapboxMap.getSource(sourceId)) {
            try {
              mapboxMap.removeSource(sourceId);
            } catch (e) {
              // Source may already be removed - ignore
            }
          }
        } catch (e) {
          // Source or layers may already be removed (e.g., during style change)
          // This is expected and safe to ignore
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PointsOfInterestLayer] Error during cleanup:', e);
          }
        }

        // Add source (no clustering)
        // Ensure source doesn't already exist before adding
        try {
          if (!mapboxMap.getSource(sourceId)) {
            mapboxMap.addSource(sourceId, {
              type: 'geojson',
              data: geoJSON,
            });
          } else {
            // Source exists, just update data
            const existingSource = mapboxMap.getSource(sourceId) as any;
            if (existingSource && existingSource.setData) {
              existingSource.setData(geoJSON);
            }
          }
        } catch (e) {
          console.error('[PointsOfInterestLayer] Error adding/updating source:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Verify source exists before adding layers
        if (!mapboxMap.getSource(sourceId)) {
          console.error('[PointsOfInterestLayer] Source does not exist before adding layer');
          isAddingLayersRef.current = false;
          return;
        }

        // Add emoji layer (symbol layer with emoji text) - similar to mention icon
        try {
          map.addLayer({
            id: emojiLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'emoji'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 0.15,   // At zoom 0, size is 0.15 (small for overview)
                5, 0.25,   // At zoom 5, size is 0.25
                10, 0.4,   // At zoom 10, size is 0.4
                12, 0.5,   // At zoom 12, size is 0.5
                14, 0.65,  // At zoom 14, size is 0.65
                16, 0.8,   // At zoom 16, size is 0.8
                18, 1.0,   // At zoom 18, size is 1.0 (full size)
                20, 1.2,   // At zoom 20, size is 1.2 (larger when zoomed in)
              ],
              'text-anchor': 'center',
              'text-allow-overlap': true,
            },
          });
        } catch (e) {
          console.error('[PointsOfInterestLayer] Error adding emoji layer:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Add labels for points (positioned above emoji)
        try {
          mapboxMap.addLayer({
            id: nameLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': [
                'case',
                ['has', 'name'],
                [
                  'case',
                  ['>', ['length', ['get', 'name']], 20],
                  ['concat', ['slice', ['get', 'name'], 0, 20], '...'],
                  ['get', 'name']
                ],
                '📍',
              ],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#6b7280',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });
        } catch (e) {
          console.error('[PointsOfInterestLayer] Error adding label layer:', e);
          // Try to remove the emoji layer if label layer failed
          try {
            if (mapboxMap.getLayer(emojiLayerId)) {
              mapboxMap.removeLayer(emojiLayerId);
            }
          } catch (removeError) {
            // Ignore removal errors
          }
          isAddingLayersRef.current = false;
          return;
        }

        isAddingLayersRef.current = false;
      } catch (error) {
        console.error('[PointsOfInterestLayer] Error loading POIs:', error);
        isAddingLayersRef.current = false;
      }
    };

    loadPOIs();

    return () => {
      mounted = false;
    };
  }, [map, mapLoaded, visible]);

  // Remove layers when not visible
  useEffect(() => {
    if (!map || !visible) {
      const mapboxMap = map as any;
      if (!mapboxMap) return;

      try {
        if (mapboxMap.getLayer(nameLayerId)) {
          mapboxMap.removeLayer(nameLayerId);
        }
      } catch (e) {
        // Layer doesn't exist
      }

      try {
        if (mapboxMap.getLayer(emojiLayerId)) {
          mapboxMap.removeLayer(emojiLayerId);
        }
      } catch (e) {
        // Layer doesn't exist
      }

      try {
        if (mapboxMap.getSource(sourceId)) {
          mapboxMap.removeSource(sourceId);
        }
      } catch (e) {
        // Source doesn't exist
      }
    }
  }, [map, visible]);

  return null;
}

