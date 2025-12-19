'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface TestMapProps {
  onMapReady?: (map: MapboxMapInstance) => void;
}

export default function TestMap({ onMapReady }: TestMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !mapContainer.current) return;
    initializedRef.current = true;

    const initializeMap = async () => {
      try {
        const mapboxgl = await loadMapboxGL();
        
        if (!MAP_CONFIG.MAPBOX_TOKEN) {
          setMapError('Mapbox token not configured');
          return;
        }

        mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
        }) as MapboxMapInstance;

        map.on('load', () => {
          setMapLoaded(true);
          if (onMapReady) {
            onMapReady(map);
          }
        });

        map.on('error', (e) => {
          console.error('Map error:', e);
          setMapError('Failed to load map');
        });

        mapInstanceRef.current = map;

        return () => {
          map.remove();
        };
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to initialize map');
      }
    };

    initializeMap();
  }, []);

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <p className="text-sm text-gray-600">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full"
        style={{ margin: 0, padding: 0 }}
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <p className="text-xs text-gray-500">Loading map...</p>
        </div>
      )}
    </div>
  );
}

