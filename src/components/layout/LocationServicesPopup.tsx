'use client';

/**
 * LocationServicesPopup
 * 
 * Compact popup in bottom right corner for location services.
 * Handles all location permission states and provides fallback options.
 * 
 * Design: Follows feed design system - compact, minimal, government-style
 */

import { useState, useEffect } from 'react';
import { MapPinIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useLocation } from '@/features/map/hooks/useLocation';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface LocationServicesPopupProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  onLocationSet?: (location: { latitude: number; longitude: number }) => void;
}

export default function LocationServicesPopup({
  map,
  mapLoaded,
  onLocationSet,
}: LocationServicesPopupProps) {
  const { location, error, errorMessage, isLoading, isSupported: isSupportedFromHook, requestLocation, clearLocation, setManualLocation } = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Use white text when transparent blur + satellite map
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  
  // Set isSupported after mount to avoid hydration mismatch
  useEffect(() => {
    setIsSupported(isSupportedFromHook);
  }, [isSupportedFromHook]);

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };

    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Listen for map click events to set manual location
  // Only update if popup is expanded (user has interacted with it)
  useEffect(() => {
    const handleMapLocationClick = (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
      }>;
      const { lat, lng } = customEvent.detail || {};
      if (lat && lng && isExpanded) {
        // Set manual location when user clicks on map (if popup is expanded)
        setManualLocation(lat, lng, 0);
        setShowManualInput(false);
      }
    };

    window.addEventListener('map-location-click', handleMapLocationClick);
    return () => {
      window.removeEventListener('map-location-click', handleMapLocationClick);
    };
  }, [isExpanded, setManualLocation]);

  // Auto-center map when location is received
  const handleLocationReceived = (loc: typeof location) => {
    if (!loc || !map || !mapLoaded) return;
    
    // Type assertion: Mapbox GL JS types don't include all runtime properties
    const mapboxMap = map as any;
    if (mapboxMap.removed) return;

    mapboxMap.flyTo({
      center: [loc.longitude, loc.latitude],
      zoom: Math.max(mapboxMap.getZoom(), 15),
      duration: 1000,
    });

    onLocationSet?.({ latitude: loc.latitude, longitude: loc.longitude });
  };

  // Handle location request button click
  const handleRequestLocation = () => {
    if (isLoading) return;
    requestLocation();
    setIsExpanded(true);
  };

  // Handle manual location via map click
  const handleUseMapClick = () => {
    setShowManualInput(false);
    setIsExpanded(false);
    // User will click on map, location will be set via map click handler
    // This just closes the popup and lets user interact with map
  };

  // Handle close
  const handleClose = () => {
    setIsExpanded(false);
    setShowManualInput(false);
    clearLocation();
  };

  // Show popup if: location exists, error exists, or user clicked to expand
  const shouldShow = location !== null || error !== null || isExpanded;

  if (!shouldShow) {
    // Collapsed button state
    return (
      <div
        className="fixed bottom-4 right-4 z-[54]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          data-user-location-button
          onClick={handleRequestLocation}
          disabled={!isSupported || isLoading}
          className={`rounded-md p-3 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
            useBlurStyle
              ? 'bg-transparent backdrop-blur-md border-2 border-transparent hover:backdrop-blur-lg'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
          aria-label="Get my location"
        >
          <MapPinIcon className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-600'}`} />
        </button>
      </div>
    );
  }

  // Expanded popup state
  return (
    <div
      className={`fixed bottom-4 right-4 z-[54] rounded-md shadow-lg max-w-[280px] ${
        useBlurStyle
          ? 'bg-transparent backdrop-blur-md border-2 border-transparent'
          : 'bg-white border border-gray-200'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MapPinIcon className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-600'}`} />
            <h3 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Location</h3>
          </div>
          <button
            onClick={handleClose}
            className={`w-6 h-6 flex items-center justify-center transition-colors rounded-md ${
              useWhiteText
                ? 'text-white/70 hover:text-white hover:bg-white/20'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 py-1">
              <div className={`w-3 h-3 border-2 rounded-full animate-spin ${
                useWhiteText ? 'border-white/30 border-t-white' : 'border-gray-300 border-t-gray-600'
              }`} />
              <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>Getting location...</p>
            </div>
          )}

          {/* Success state */}
          {location && !isLoading && (
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                    {location.source === 'gps' ? 'GPS Location' : 'Manual Location'}
                  </span>
                </div>
                <div className={`flex items-center gap-2 text-xs font-mono ${
                  useWhiteText ? 'text-white/80' : 'text-gray-600'
                }`}>
                  <span>{location.latitude.toFixed(6)}</span>
                  <span className={useWhiteText ? 'text-white/50' : 'text-gray-400'}>,</span>
                  <span>{location.longitude.toFixed(6)}</span>
                </div>
                {location.accuracy > 0 && (
                  <p className={`text-xs ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
                    Accuracy: {Math.round(location.accuracy)}m
                  </p>
                )}
              </div>
              <button
                onClick={() => handleLocationReceived(location)}
                className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                  useBlurStyle
                    ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                Center Map
              </button>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="space-y-2">
              <div className="flex items-start gap-1.5">
                <ExclamationTriangleIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                  useWhiteText ? 'text-white/70' : 'text-gray-500'
                }`} />
                <div className="flex-1 space-y-1">
                  <p className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>{errorMessage}</p>
                  {error.type === 'permission_denied' && (
                    <p className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                      You can set location manually by clicking on the map.
                    </p>
                  )}
                </div>
              </div>
              
              {error.type === 'permission_denied' && (
                <button
                  onClick={() => setShowManualInput(true)}
                  className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                    useBlurStyle
                      ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  Use Map Click
                </button>
              )}
              
              {error.type !== 'permission_denied' && (
                <button
                  onClick={handleRequestLocation}
                  className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                    useBlurStyle
                      ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Manual input instructions */}
          {showManualInput && (
            <div className="space-y-2">
              <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
                Click anywhere on the map to set your location manually.
              </p>
              <button
                onClick={handleUseMapClick}
                className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                  useBlurStyle
                    ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                Got It
              </button>
            </div>
          )}

          {/* Initial state (no location, no error, expanded) */}
          {!location && !error && !isLoading && (
            <div className="space-y-2">
              <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
                Get your current location or click on the map to set it manually.
              </p>
              <button
                onClick={handleRequestLocation}
                disabled={!isSupported}
                className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  useBlurStyle
                    ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 disabled:bg-white/10 disabled:hover:bg-white/10'
                    : 'bg-gray-900 hover:bg-gray-800 text-white disabled:bg-gray-300 disabled:hover:bg-gray-300'
                }`}
              >
                Get My Location
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

