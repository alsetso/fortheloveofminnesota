'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { MapPinIcon } from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import { watchGeolocation, getCurrentPosition, getGeolocationErrorMessage, type GeolocationError } from '@/utils/geolocation';

interface NearbyPlace {
  id: string;
  name: string;
  table_name: string;
  lat: number;
  lng: number;
  distance?: number;
  icon_path?: string | null;
}

interface NearbyPlacesContainerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isVisible?: boolean; // Whether the container should be visible (e.g., when explore tab is open)
}

/**
 * Container showing nearby atlas places based on map center
 * Displays inline in the explore tab
 */
export default function NearbyPlacesContainer({ 
  map, 
  mapLoaded,
  isVisible = true
}: NearbyPlacesContainerProps) {
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(0);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const watchIdRef = useRef<{ stop: () => void } | null>(null);
  const userLocationMarkerRef = useRef<any>(null);
  const minZoom = 12;

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }, []);

  // Fetch nearby places
  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    if (!map || !mapLoaded) return;

    setIsLoading(true);
    try {
      // Calculate bounding box (roughly 2km radius)
      const radiusKm = 2;
      const latDelta = radiusKm / 111; // Rough conversion: 1 degree lat ≈ 111 km
      const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

      const { data, error } = await supabase
        .from('atlas_entities')
        .select('id, name, table_name, lat, lng')
        .gte('lat', lat - latDelta)
        .lte('lat', lat + latDelta)
        .gte('lng', lng - lngDelta)
        .lte('lng', lng + lngDelta)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(10);

      if (error) {
        console.error('[NearbyPlacesContainer] Error fetching nearby places:', error);
        setNearbyPlaces([]);
        return;
      }

      if (data) {
        // Get unique table names to fetch icons
        const tableNames = [...new Set((data as NearbyPlace[]).map(p => p.table_name))];
        
        // Fetch icon paths from atlas_types
        const iconPaths: Record<string, string | null> = {};
        if (tableNames.length > 0) {
          try {
            const { data: typesData } = await (supabase as any)
              .schema('atlas')
              .from('atlas_types')
              .select('slug, icon_path')
              .in('slug', tableNames);
            
            if (typesData) {
              typesData.forEach((type: { slug: string; icon_path: string | null }) => {
                iconPaths[type.slug] = type.icon_path;
              });
            }
          } catch (error) {
            console.error('[NearbyPlacesContainer] Error fetching atlas types:', error);
          }
        }
        
        // Calculate distances and sort by proximity, add icon paths
        const placesWithDistance = (data as NearbyPlace[]).map(place => ({
          ...place,
          distance: calculateDistance(lat, lng, place.lat, place.lng),
          icon_path: iconPaths[place.table_name] || null,
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0))
          .slice(0, 5); // Top 5 closest

        setNearbyPlaces(placesWithDistance);
      }
    } catch (error) {
      console.error('[NearbyPlacesContainer] Error fetching nearby places:', error);
      setNearbyPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [map, mapLoaded, calculateDistance]);

  // Listen to map center and zoom changes
  useEffect(() => {
    if (!map || !mapLoaded || !isVisible) {
      setNearbyPlaces([]);
      setCurrentZoom(0);
      return;
    }

    const mapboxMap = map as any;
    
    const updatePlaces = () => {
      const centerObj = mapboxMap.getCenter();
      const zoom = mapboxMap.getZoom();
      
      setCurrentZoom(zoom);
      
      // Only fetch nearby places if zoomed in enough
      if (centerObj && zoom >= minZoom) {
        setCenter({ lat: centerObj.lat, lng: centerObj.lng });
        fetchNearbyPlaces(centerObj.lat, centerObj.lng);
      } else {
        // Clear places if zoomed out too far
        setNearbyPlaces([]);
      }
    };

    // Initial update
    updatePlaces();

    // Listen to map events (debounced)
    let timeoutId: NodeJS.Timeout;
    const handleMapMove = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updatePlaces, 500);
    };

    mapboxMap.on('moveend', handleMapMove);
    mapboxMap.on('zoomend', handleMapMove);
    mapboxMap.on('zoom', handleMapMove);

    return () => {
      clearTimeout(timeoutId);
      mapboxMap.off('moveend', handleMapMove);
      mapboxMap.off('zoomend', handleMapMove);
      mapboxMap.off('zoom', handleMapMove);
    };
  }, [map, mapLoaded, isVisible, fetchNearbyPlaces]);

  // Add/update user location marker on map
  const updateUserLocationMarker = useCallback(async (lat: number, lng: number) => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    
    try {
      const { loadMapboxGL } = await import('@/features/map/utils/mapboxLoader');
      const mapbox = await loadMapboxGL();

      // Remove existing marker if any
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }

      // Create basic native pin marker element
      const el = document.createElement('div');
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #4285f4;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        pointer-events: none;
      `;

      // Create and add marker
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([lng, lat])
        .addTo(mapboxMap);

      userLocationMarkerRef.current = marker;
    } catch (err) {
      console.error('[NearbyPlacesContainer] Error creating user location marker:', err);
    }
  }, [map, mapLoaded]);

  // Remove user location marker
  const removeUserLocationMarker = useCallback(() => {
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove();
      userLocationMarkerRef.current = null;
    }
  }, []);

  // Handle Find Me toggle
  const handleFindMeToggle = useCallback(() => {
    if (!map || !mapLoaded) return;
    
    if (isTrackingLocation) {
      // Stop tracking
      if (watchIdRef.current) {
        watchIdRef.current.stop();
        watchIdRef.current = null;
      }
      removeUserLocationMarker();
      setIsTrackingLocation(false);
      setLocationPermissionDenied(false);
    } else {
      // Start tracking
      const mapboxMap = map as any;
      
      // First, request permission with getCurrentPosition
      // This triggers the browser permission prompt if needed
      getCurrentPosition(
        (position) => {
          // Permission granted, now start watching
          setLocationPermissionDenied(false);
          
          // Add marker and fly to location
          updateUserLocationMarker(position.latitude, position.longitude);
          mapboxMap.flyTo({
            center: [position.longitude, position.latitude],
            zoom: Math.max(mapboxMap.getZoom(), 15),
            duration: 1000,
          });

          // Start continuous tracking
          const watchResult = watchGeolocation(
            (pos) => {
              setLocationPermissionDenied(false);
              
              // Update marker position
              updateUserLocationMarker(pos.latitude, pos.longitude);
              
              // Smoothly update map center as user moves
              mapboxMap.flyTo({
                center: [pos.longitude, pos.latitude],
                zoom: Math.max(mapboxMap.getZoom(), 15),
                duration: 500,
              });
            },
            (error: GeolocationError) => {
              console.error('Geolocation watch error:', error);
              handleGeolocationError(error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000, // Accept cached position up to 5 seconds old
            }
          );
          
          watchIdRef.current = watchResult;
          setIsTrackingLocation(true);
        },
        (error: GeolocationError) => {
          console.error('Geolocation getCurrentPosition error:', error);
          handleGeolocationError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }, [map, mapLoaded, isTrackingLocation, updateUserLocationMarker, removeUserLocationMarker]);

  // Handle geolocation errors
  const handleGeolocationError = useCallback((error: GeolocationError) => {
    if (error.type === 'permission_denied') {
      setLocationPermissionDenied(true);
      setIsTrackingLocation(false);
      removeUserLocationMarker();
      if (watchIdRef.current) {
        watchIdRef.current.stop();
        watchIdRef.current = null;
      }
    } else if (error.type === 'position_unavailable') {
      console.warn('Location information unavailable');
      setLocationPermissionDenied(true);
    } else if (error.type === 'timeout') {
      console.warn('Location request timed out');
      setLocationPermissionDenied(true);
    }
  }, [removeUserLocationMarker]);

  // Cleanup watch and marker on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        watchIdRef.current.stop();
      }
      removeUserLocationMarker();
    };
  }, [removeUserLocationMarker]);

  if (!isVisible) {
    return null;
  }

  const isZoomedInEnough = currentZoom >= minZoom;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-900">
          Nearby Places
        </div>
        <button
          onClick={handleFindMeToggle}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            isTrackingLocation
              ? 'bg-gray-900 text-white hover:bg-gray-800'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <MapPinIcon className={`w-3.5 h-3.5 ${isTrackingLocation ? 'text-white' : 'text-gray-600'}`} />
          <span>Find Me</span>
        </button>
      </div>
      
      {locationPermissionDenied && (
        <div className="text-[10px] text-gray-500 px-2 py-1 bg-gray-50 rounded-md">
          {getGeolocationErrorMessage({
            code: 1,
            message: 'Location access denied',
            type: 'permission_denied',
          })}
        </div>
      )}
      {!isZoomedInEnough ? (
        <div className="text-xs text-gray-600 py-3 px-2 bg-gray-50 rounded-md">
          <p className="mb-1">Zoom in to see nearby places</p>
          <p className="text-[10px] text-gray-500">
            Pinch to zoom or use the map controls to zoom in closer
          </p>
        </div>
      ) : isLoading ? (
        <div className="text-xs text-gray-500 py-2">Loading...</div>
      ) : nearbyPlaces.length === 0 ? (
        <div className="text-xs text-gray-500 py-2">No nearby places found</div>
      ) : (
        <div className="space-y-1">
          {nearbyPlaces.map((place) => (
            <button
              key={place.id}
              onClick={() => {
                if (map) {
                  const mapboxMap = map as any;
                  mapboxMap.flyTo({
                    center: [place.lng, place.lat],
                    zoom: 15,
                    duration: 1000,
                  });
                }
              }}
              className="w-full flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 p-2 rounded-md transition-colors text-left"
            >
              {place.icon_path ? (
                <Image
                  src={place.icon_path}
                  alt={place.name}
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 object-contain flex-shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-3.5 h-3.5 bg-gray-200 rounded flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{place.name}</div>
                {place.distance !== undefined && (
                  <div className="text-[10px] text-gray-500">
                    {(place.distance * 0.621371).toFixed(2)} mi away
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

