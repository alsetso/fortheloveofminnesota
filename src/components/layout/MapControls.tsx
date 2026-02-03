'use client';

import { useState, useEffect, useRef } from 'react';
import { GlobeAltIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useMapboxGeolocate } from './useMapboxGeolocate';

interface MapControlsProps {
  /** Map instance for controlling map style and location */
  map?: any;
  /** Whether controls should be visible */
  visible: boolean;
}

/**
 * Map controls component - shows map style and user location buttons
 * Positioned in top-right corner (outside AppContentWidth overlay)
 * iOS Maps-style rounded buttons
 */
export default function MapControls({ map, visible }: MapControlsProps) {
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [showUserLocation, setShowUserLocation] = useState(false);
  const locationButtonRef = useRef<HTMLButtonElement>(null);
  const geolocateTriggerRef = useRef<(() => void) | null>(null);

  // Use Mapbox's built-in GeolocateControl
  const geolocateResult = useMapboxGeolocate({
    map: map || null,
    enabled: showUserLocation && visible,
    buttonEl: locationButtonRef.current,
  });
  
  // Store trigger function
  useEffect(() => {
    console.log('[MapControls] geolocateResult changed:', geolocateResult);
    if (geolocateResult?.trigger) {
      console.log('[MapControls] Setting trigger function');
      geolocateTriggerRef.current = geolocateResult.trigger;
      
      // Test that the trigger function is callable
      console.log('[MapControls] Trigger function type:', typeof geolocateResult.trigger);
      console.log('[MapControls] Trigger function:', geolocateResult.trigger.toString().substring(0, 100));
    } else {
      console.warn('[MapControls] No trigger function in geolocateResult');
    }
  }, [geolocateResult]);
  
  // Debug: Log when button ref is set
  useEffect(() => {
    console.log('[MapControls] locationButtonRef.current:', locationButtonRef.current);
    if (locationButtonRef.current) {
      console.log('[MapControls] Button element found, onClick should be attached');
    }
  }, [locationButtonRef.current]);

  // Detect current map style
  useEffect(() => {
    if (!map || !visible) return;
    
    try {
      const style = (map as any).getStyle();
      if (style) {
        const styleUrl = style.sources?.['mapbox-satellite'] ? 'satellite' : 'street';
        setMapStyle(styleUrl);
      }
    } catch {
      // Ignore errors
    }
  }, [map, visible]);

  if (!visible) return null;

  const handleMapStyleToggle = () => {
    if (!map) return;
    
    const mapboxMap = map as any;
    if (!mapboxMap || mapboxMap.removed) return;
    
    // Toggle between street and satellite
    const newStyle = mapStyle === 'street' ? 'satellite' : 'street';
    
    // Import MAP_CONFIG to get style URLs
    import('@/features/map/config').then(({ MAP_CONFIG }) => {
      const styleUrl = newStyle === 'satellite' 
        ? MAP_CONFIG.STRATEGIC_STYLES.satellite
        : MAP_CONFIG.STRATEGIC_STYLES.streets;
      
      mapboxMap.setStyle(styleUrl);
      setMapStyle(newStyle);
    }).catch((err) => {
      console.error('Error toggling map style:', err);
    });
  };

  const handleUserLocationToggle = async () => {
    console.log('[MapControls] handleUserLocationToggle clicked');
    console.log('[MapControls] showUserLocation:', showUserLocation);
    console.log('[MapControls] geolocateTriggerRef.current:', geolocateTriggerRef.current);
    console.log('[MapControls] map:', map);
    console.log('[MapControls] visible:', visible);
    
    const newState = !showUserLocation;
    setShowUserLocation(newState);
    
    // Always trigger geolocation when button is clicked (even if already enabled)
    // This ensures it flies to user location on every click
    if (geolocateTriggerRef.current) {
      console.log('[MapControls] Calling trigger function...');
      try {
        await geolocateTriggerRef.current();
        console.log('[MapControls] Trigger function completed');
      } catch (err) {
        console.error('[MapControls] Error calling trigger:', err);
      }
    } else {
      console.warn('[MapControls] Trigger function not available');
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-auto flex flex-col gap-2">
      {/* Map Style Button */}
      <button
        type="button"
        onClick={handleMapStyleToggle}
        className="w-10 h-10 rounded-lg bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md flex items-center justify-center hover:bg-white active:bg-gray-50 transition-colors"
        aria-label="Toggle map style"
      >
        <GlobeAltIcon className="w-5 h-5 text-gray-700" />
      </button>

      {/* User Location Button - Toggle */}
      <button
        ref={locationButtonRef}
        type="button"
        onClick={(e) => {
          console.log('[MapControls] Button onClick fired!', e);
          e.preventDefault();
          e.stopPropagation();
          handleUserLocationToggle();
        }}
        onMouseDown={(e) => {
          console.log('[MapControls] Button onMouseDown fired!', e);
        }}
        className={`w-10 h-10 rounded-lg backdrop-blur-sm border shadow-md flex items-center justify-center hover:bg-white active:bg-gray-50 transition-colors ${
          showUserLocation
            ? 'bg-blue-50 border-blue-300'
            : 'bg-white/95 border-gray-200'
        }`}
        aria-label={showUserLocation ? 'Hide my location' : 'Show my location'}
        aria-pressed={showUserLocation}
        style={{ pointerEvents: 'auto', zIndex: 1000 }}
      >
        <MapPinIcon className={`w-5 h-5 ${
          showUserLocation ? 'text-blue-600' : 'text-gray-700'
        }`} />
      </button>
    </div>
  );
}
