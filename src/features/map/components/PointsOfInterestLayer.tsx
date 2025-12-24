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

        const mapboxMap = map as any;

        // Wait for style to load
        if (!mapboxMap.isStyleLoaded()) {
          await new Promise<void>(resolve => {
            const checkStyle = () => {
              if (mapboxMap.isStyleLoaded()) {
                resolve();
              } else {
                requestAnimationFrame(checkStyle);
              }
            };
            checkStyle();
          });
        }

        if (!mounted) return;

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

        isAddingLayersRef.current = true;

        // Add or update source
        let sourceExists = false;
        try {
          const existingSource = mapboxMap.getSource(sourceId);
          if (existingSource && existingSource.type === 'geojson') {
            (existingSource as any).setData(geoJSON);
            sourceExists = true;
          }
        } catch (e) {
          // Source doesn't exist, will add it
        }

        if (!sourceExists) {
          try {
            mapboxMap.addSource(sourceId, {
              type: 'geojson',
              data: geoJSON,
            });
          } catch (e) {
            console.error('[PointsOfInterestLayer] Error adding source:', e);
            isAddingLayersRef.current = false;
            return;
          }
        }

        // Add emoji layer (symbol layer with emoji text)
        let emojiLayerExists = false;
        try {
          mapboxMap.getLayer(emojiLayerId);
          emojiLayerExists = true;
        } catch (e) {
          // Layer doesn't exist
        }

        if (!emojiLayerExists) {
          try {
            mapboxMap.addLayer({
              id: emojiLayerId,
              type: 'symbol',
              source: sourceId,
              layout: {
                'text-field': ['get', 'emoji'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 12,
                  10, 16,
                  14, 20,
                  18, 24,
                ],
                'text-anchor': 'center',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
              },
            });
          } catch (e) {
            console.error('[PointsOfInterestLayer] Error adding emoji layer:', e);
            isAddingLayersRef.current = false;
            return;
          }
        }

        // Add name layer (labels below emoji)
        let nameLayerExists = false;
        try {
          mapboxMap.getLayer(nameLayerId);
          nameLayerExists = true;
        } catch (e) {
          // Layer doesn't exist
        }

        if (!nameLayerExists) {
          try {
            mapboxMap.addLayer({
              id: nameLayerId,
              type: 'symbol',
              source: sourceId,
              layout: {
                'text-field': ['get', 'name'],
                'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 8,
                  10, 10,
                  14, 12,
                  18, 14,
                ],
                'text-anchor': 'top',
                'text-offset': [0, 1.2],
                'text-optional': true,
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': '#1f2937',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
                'text-halo-blur': 1,
              },
            });
          } catch (e) {
            console.error('[PointsOfInterestLayer] Error adding name layer:', e);
            // Try to remove the emoji layer if name layer failed
            try {
              if (mapboxMap.getLayer(emojiLayerId)) {
                mapboxMap.removeLayer(emojiLayerId);
              }
            } catch (removeError) {
              // Ignore
            }
            isAddingLayersRef.current = false;
            return;
          }
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

