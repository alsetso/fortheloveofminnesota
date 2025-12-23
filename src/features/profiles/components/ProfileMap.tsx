'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import ProfileMentionsLayer from './ProfileMentionsLayer';
import type { ProfilePin } from '@/types/profile';

interface ProfileMapProps {
  pins: ProfilePin[];
  isOwnProfile: boolean;
  searchQuery: string;
  visibilityFilter: 'all' | 'public' | 'only_me';
}

export default function ProfileMap({ pins, isOwnProfile, searchQuery, visibilityFilter }: ProfileMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);

  // Filter pins based on search and visibility
  const filteredPins = pins.filter((pin) => {
    // Apply visibility filter (only for owners)
    if (isOwnProfile && visibilityFilter !== 'all') {
      if (pin.visibility !== visibilityFilter) return false;
    } else if (!isOwnProfile) {
      // For visitors, only show public mentions
      if (pin.visibility !== 'public') return false;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const formatCoordinates = (lat: number, lng: number): string => {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      };
      const matchesSearch = 
        pin.description?.toLowerCase().includes(query) ||
        formatCoordinates(pin.lat, pin.lng).includes(query);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      setMapError('missing-token');
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current) return;

      try {
        // @ts-ignore - CSS import
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
          }
        });

        mapInstance.on('error', (e) => {
          console.error('[ProfileMap] Map error:', e);
          if (mounted) {
            setMapError('load-error');
          }
        });

        // Fit bounds to pins if available
        if (filteredPins.length > 0) {
          mapInstance.once('load', () => {
            if (!mounted) return;
            
            const lngs = filteredPins.map((p) => p.lng);
            const lats = filteredPins.map((p) => p.lat);
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
        if (mounted) {
          setMapError('init-error');
        }
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

  // Update map bounds when filtered pins change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || filteredPins.length === 0) return;

    const lngs = filteredPins.map((p) => p.lng);
    const lats = filteredPins.map((p) => p.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    mapInstanceRef.current.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 50,
        maxZoom: 14,
      }
    );
  }, [mapLoaded, filteredPins]);

  if (mapError) {
    return (
      <div className="h-[300px] bg-gray-100 border border-gray-200 rounded-md flex items-center justify-center">
        <p className="text-xs text-gray-500">Map unavailable</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] bg-gray-100 border border-gray-200 rounded-md overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      {mapLoaded && mapInstanceRef.current && (
        <ProfileMentionsLayer
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          pins={filteredPins}
        />
      )}
    </div>
  );
}
