'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { ProfilePin } from '@/types/profile';

interface ProfileMapProps {
  pins: ProfilePin[];
}

const SOURCE_ID = 'profile-mentions';
const LAYER_IDS = {
  points: 'profile-mentions-point',
  labels: 'profile-mentions-point-label',
} as const;

export default function ProfileMap({ pins = [] }: ProfileMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);

  // Convert pins to GeoJSON
  const pinsToGeoJSON = (pins: ProfilePin[]) => {
    const features = pins.map((pin) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.lng, pin.lat] as [number, number],
      },
      properties: {
        id: pin.id,
        description: pin.description || '',
      },
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  };

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            // Trigger resize after a short delay to ensure container is fully rendered
            setTimeout(() => {
              if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                mapInstance.resize();
              }
            }, 100);
          }
        });

        // Fit bounds to pins if available (only on initial load)
        if (pins.length > 0) {
          mapInstance.once('load', () => {
            if (!mounted) return;
            
            const lngs = pins.map((p) => p.lng);
            const lats = pins.map((p) => p.lat);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            mapInstance.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              {
                padding: 50,
                maxZoom: 14,
              }
            );
          });
        }
      } catch (error) {
        console.error('[ProfileMap] Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // Map may already be removed
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle map resize when container size changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !mapContainer.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current && !(mapInstanceRef.current as MapboxMapInstance)._removed) {
        setTimeout(() => {
          if (mapInstanceRef.current && !(mapInstanceRef.current as MapboxMapInstance)._removed) {
            mapInstanceRef.current.resize();
          }
        }, 100);
      }
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapLoaded]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const mapboxMap = mapInstanceRef.current as any;
    const geoJSON = pinsToGeoJSON(pins);

    try {
      // Add or update source
      let sourceExists = false;
      try {
        const existingSource = mapboxMap.getSource(SOURCE_ID);
        if (existingSource && existingSource.type === 'geojson') {
          existingSource.setData(geoJSON);
          sourceExists = true;
        }
      } catch (e) {
        // Source doesn't exist, will add it
      }

      if (!sourceExists) {
        try {
          mapboxMap.addSource(SOURCE_ID, {
            type: 'geojson',
            data: geoJSON,
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding source:', e);
          return;
        }
      }

      // Add circle layer for points (native Mapbox circle marker)
      let pointsLayerExists = false;
      try {
        mapboxMap.getLayer(LAYER_IDS.points);
        pointsLayerExists = true;
      } catch (e) {
        // Layer doesn't exist
      }

      if (!pointsLayerExists) {
        try {
          mapboxMap.addLayer({
            id: LAYER_IDS.points,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-radius': 8,
              'circle-color': '#ef4444',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding points layer:', e);
        }
      }

      // Add label layer if it doesn't exist
      let labelsLayerExists = false;
      try {
        mapboxMap.getLayer(LAYER_IDS.labels);
        labelsLayerExists = true;
      } catch (e) {
        // Layer doesn't exist
      }

      if (!labelsLayerExists) {
        try {
          mapboxMap.addLayer({
            id: LAYER_IDS.labels,
            type: 'symbol',
            source: SOURCE_ID,
            layout: {
              'text-field': [
                'case',
                ['!=', ['get', 'description'], ''],
                ['get', 'description'],
                ''
              ],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-offset': [0, 2],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': '#374151',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });
        } catch (e) {
          console.error('[ProfileMap] Error adding labels layer:', e);
        }
      }

      // Fit bounds to filtered pins when they change (if map is already loaded)
      if (pins.length > 0 && mapLoaded) {
        const lngs = pins.map((p) => p.lng);
        const lats = pins.map((p) => p.lat);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Only fit bounds if we have valid coordinates
        if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
          mapboxMap.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            {
              padding: 50,
              maxZoom: 14,
              duration: 500,
            }
          );
        }
      }
    } catch (error) {
      console.error('[ProfileMap] Error setting up layers:', error);
    }
  }, [mapLoaded, pins]);

  return (
    <div className="relative w-full h-full bg-gray-100 overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

