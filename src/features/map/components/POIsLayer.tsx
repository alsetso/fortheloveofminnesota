'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { POIService, type PointOfInterest } from '@/features/poi/services/poiService';

interface POIsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  draftPOIs: Array<{ id: string; lat: number; lng: number; name: string; emoji?: string }>;
  activePOIs: PointOfInterest[];
}

/**
 * POIsLayer component manages POI visualization on map
 * Shows both draft (pending) and active (saved) POIs
 */
export default function POIsLayer({ map, mapLoaded, draftPOIs, activePOIs }: POIsLayerProps) {
  const draftSourceId = 'pois-draft';
  const activeSourceId = 'pois-active';
  const draftLayerId = 'pois-draft-point';
  const activeLayerId = 'pois-active-point';
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;

    // Convert POIs to GeoJSON
    const draftGeoJSON = {
      type: 'FeatureCollection' as const,
      features: draftPOIs.map(poi => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [poi.lng, poi.lat],
        },
        properties: {
          id: poi.id,
          name: poi.name,
          emoji: poi.emoji || '📍',
          isDraft: true,
        },
      })),
    };

    const activeGeoJSON = {
      type: 'FeatureCollection' as const,
      features: activePOIs.map(poi => {
        // Extract coordinates from geography
        let lng: number, lat: number;
        if (typeof poi.location === 'string') {
          const match = poi.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
          if (match) {
            lng = parseFloat(match[1]);
            lat = parseFloat(match[2]);
          } else {
            return null;
          }
        } else if (poi.location && typeof poi.location === 'object') {
          if (poi.location.coordinates && Array.isArray(poi.location.coordinates)) {
            lng = poi.location.coordinates[0];
            lat = poi.location.coordinates[1];
          } else {
            return null;
          }
        } else {
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat],
          },
          properties: {
            id: poi.id,
            name: poi.name || 'Unnamed POI',
            emoji: poi.emoji || '📍',
            category: poi.category,
            isDraft: false,
          },
        };
      }).filter(Boolean),
    };

    // Add/update draft POIs source
    try {
      const existingDraftSource = mapboxMap.getSource(draftSourceId);
      if (existingDraftSource) {
        existingDraftSource.setData(draftGeoJSON);
      } else {
        mapboxMap.addSource(draftSourceId, {
          type: 'geojson',
          data: draftGeoJSON,
        });

        // Add draft layer (semi-transparent, different style)
        if (!mapboxMap.getLayer(draftLayerId)) {
          mapboxMap.addLayer({
            id: draftLayerId,
            type: 'circle',
            source: draftSourceId,
            paint: {
              'circle-radius': 6,
              'circle-color': '#9CA3AF', // Gray for draft
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
              'circle-opacity': 0.7,
            },
          });
        }
      }
    } catch (error) {
      console.error('[POIsLayer] Error with draft source:', error);
    }

    // Add/update active POIs source
    try {
      const existingActiveSource = mapboxMap.getSource(activeSourceId);
      if (existingActiveSource) {
        existingActiveSource.setData(activeGeoJSON);
      } else {
        mapboxMap.addSource(activeSourceId, {
          type: 'geojson',
          data: activeGeoJSON,
        });

        // Add active layer (solid, different color)
        if (!mapboxMap.getLayer(activeLayerId)) {
          mapboxMap.addLayer({
            id: activeLayerId,
            type: 'circle',
            source: activeSourceId,
            paint: {
              'circle-radius': 8,
              'circle-color': '#EF4444', // Red for active
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
              'circle-opacity': 1,
            },
          });
        }
      }
    } catch (error) {
      console.error('[POIsLayer] Error with active source:', error);
    }

    initializedRef.current = true;
  }, [map, mapLoaded, draftPOIs, activePOIs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map || map.removed) return;
      const mapboxMap = map as any;
      
      try {
        if (mapboxMap.getLayer(draftLayerId)) mapboxMap.removeLayer(draftLayerId);
        if (mapboxMap.getSource(draftSourceId)) mapboxMap.removeSource(draftSourceId);
        if (mapboxMap.getLayer(activeLayerId)) mapboxMap.removeLayer(activeLayerId);
        if (mapboxMap.getSource(activeSourceId)) mapboxMap.removeSource(activeSourceId);
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, [map]);

  return null;
}
