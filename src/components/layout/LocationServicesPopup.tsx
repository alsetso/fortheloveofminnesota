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
  const { location, error, errorMessage, isLoading, isSupported, requestLocation, clearLocation, setManualLocation } = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

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
          onClick={handleRequestLocation}
          disabled={!isSupported || isLoading}
          className="bg-white border border-gray-200 rounded-md p-[10px] shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Get my location"
        >
          <MapPinIcon className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    );
  }

  // Expanded popup state
  return (
    <div
      className="fixed bottom-4 right-4 z-[54] bg-white border border-gray-200 rounded-md shadow-sm max-w-[280px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="p-[10px] space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Location</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <p className="text-xs text-gray-600">Getting location...</p>
            </div>
          )}

          {/* Success state */}
          {location && !isLoading && (
            <div className="space-y-2">
              <div className="space-y-0.5">
                <p className="text-xs text-gray-600">
                  {location.source === 'gps' ? 'GPS Location' : 'Manual Location'}
                </p>
                <p className="text-xs text-gray-500">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
                {location.accuracy > 0 && (
                  <p className="text-xs text-gray-500">
                    Accuracy: {Math.round(location.accuracy)}m
                  </p>
                )}
              </div>
              <button
                onClick={() => handleLocationReceived(location)}
                className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                Center Map
              </button>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="space-y-2">
              <div className="flex items-start gap-1.5">
                <ExclamationTriangleIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-xs text-gray-600">{errorMessage}</p>
                  {error.type === 'permission_denied' && (
                    <p className="text-xs text-gray-500">
                      You can set location manually by clicking on the map.
                    </p>
                  )}
                </div>
              </div>
              
              {error.type === 'permission_denied' && (
                <button
                  onClick={() => setShowManualInput(true)}
                  className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Use Map Click
                </button>
              )}
              
              {error.type !== 'permission_denied' && (
                <button
                  onClick={handleRequestLocation}
                  className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* Manual input instructions */}
          {showManualInput && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Click anywhere on the map to set your location manually.
              </p>
              <button
                onClick={handleUseMapClick}
                className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                Got It
              </button>
            </div>
          )}

          {/* Initial state (no location, no error, expanded) */}
          {!location && !error && !isLoading && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Get your current location or click on the map to set it manually.
              </p>
              <button
                onClick={handleRequestLocation}
                disabled={!isSupported}
                className="w-full text-xs font-medium text-gray-700 hover:text-gray-900 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

