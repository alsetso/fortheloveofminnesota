'use client';

import { useCallback } from 'react';
import { 
  MapPinIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MapControlsProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

export default function MapControls({ map, mapLoaded }: MapControlsProps) {
  const handleFindMe = useCallback(() => {
    if (!map || !mapLoaded || !navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const isInMinnesota = 
          latitude >= 43.5 && latitude <= 49.5 &&
          longitude >= -97.5 && longitude <= -89.5;

        if (!isInMinnesota) {
          alert('Your location is outside Minnesota. The map is limited to Minnesota state boundaries.');
          return;
        }

        if (map && !map.removed) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1500,
          });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enable location access in your browser settings.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [map, mapLoaded]);

  const handleZoomIn = useCallback(() => {
    if (!map || !mapLoaded) return;
    const currentZoom = map.getZoom();
    map.zoomTo(currentZoom + 1, { duration: 300 });
  }, [map, mapLoaded]);

  const handleZoomOut = useCallback(() => {
    if (!map || !mapLoaded) return;
    const currentZoom = map.getZoom();
    map.zoomTo(currentZoom - 1, { duration: 300 });
  }, [map, mapLoaded]);

  return (
    <div 
      className="fixed bottom-4 right-4 z-30 flex flex-col gap-2"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '12px',
        padding: '8px',
      }}
    >
      {/* User Location Button */}
      <button
        onClick={handleFindMe}
        disabled={!mapLoaded}
        className="
          flex items-center justify-center w-10 h-10 rounded-lg transition-colors
          text-gray-700 hover:text-gray-900 hover:bg-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="Find My Location"
      >
        <MapPinIcon className="w-5 h-5" />
      </button>

      {/* Zoom In Button */}
      <button
        onClick={handleZoomIn}
        disabled={!mapLoaded}
        className="
          flex items-center justify-center w-10 h-10 rounded-lg transition-colors
          text-gray-700 hover:text-gray-900 hover:bg-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="Zoom In"
      >
        <PlusIcon className="w-5 h-5" />
      </button>

      {/* Zoom Out Button */}
      <button
        onClick={handleZoomOut}
        disabled={!mapLoaded}
        className="
          flex items-center justify-center w-10 h-10 rounded-lg transition-colors
          text-gray-700 hover:text-gray-900 hover:bg-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        title="Zoom Out"
      >
        <MinusIcon className="w-5 h-5" />
      </button>
    </div>
  );
}



