'use client';

import { useCallback } from 'react';
import { 
  MapPinIcon,
  PlusIcon,
  MinusIcon,
  CubeIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

// Road icon SVG component
const RoadIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M4 19L8 5" />
    <path d="M16 5L20 19" />
    <path d="M12 6V8" />
    <path d="M12 11V13" />
    <path d="M12 16V18" />
  </svg>
);

interface MapControlsProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  is3DMode?: boolean;
  on3DToggle?: (enabled: boolean) => void;
  roadsVisible?: boolean;
  onRoadsToggle?: (visible: boolean) => void;
}

export default function MapControls({ 
  map, 
  mapLoaded, 
  is3DMode = false, 
  on3DToggle,
  roadsVisible = true,
  onRoadsToggle,
}: MapControlsProps) {
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

  const handle3DToggle = useCallback(() => {
    if (!map || !mapLoaded || !on3DToggle) return;
    on3DToggle(!is3DMode);
  }, [map, mapLoaded, is3DMode, on3DToggle]);

  const handleRoadsToggle = useCallback(() => {
    if (!map || !mapLoaded || !onRoadsToggle) return;
    onRoadsToggle(!roadsVisible);
  }, [map, mapLoaded, roadsVisible, onRoadsToggle]);

  return (
    <div 
      className="fixed bottom-[10px] right-[10px] z-30 flex flex-col gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-md p-[10px]"
    >
      {/* User Location Button */}
      <button
        onClick={handleFindMe}
        disabled={!mapLoaded}
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Find My Location"
      >
        <MapPinIcon className="w-4 h-4" />
      </button>

      {/* 2D/3D Toggle Button */}
      {on3DToggle && (
        <button
          onClick={handle3DToggle}
          disabled={!mapLoaded}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            is3DMode
              ? 'bg-white/30 text-white'
              : 'text-white hover:bg-white/20'
          }`}
          title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
        >
          {is3DMode ? (
            <CubeIcon className="w-4 h-4" />
          ) : (
            <ViewColumnsIcon className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Roads Toggle Button */}
      {onRoadsToggle && (
        <button
          onClick={handleRoadsToggle}
          disabled={!mapLoaded}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            roadsVisible
              ? 'text-white hover:bg-white/20'
              : 'bg-white/30 text-white'
          }`}
          title={roadsVisible ? 'Hide Roads' : 'Show Roads'}
        >
          <RoadIcon className="w-4 h-4" />
        </button>
      )}

      {/* Zoom In Button */}
      <button
        onClick={handleZoomIn}
        disabled={!mapLoaded}
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom In"
      >
        <PlusIcon className="w-4 h-4" />
      </button>

      {/* Zoom Out Button */}
      <button
        onClick={handleZoomOut}
        disabled={!mapLoaded}
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom Out"
      >
        <MinusIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

