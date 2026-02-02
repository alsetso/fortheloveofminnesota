'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import { MapIcon } from '@heroicons/react/24/outline';

export default function HomepageMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
          // Disable all interactions except zoom
          dragRotate: false,
          touchZoomRotate: true, // Allow pinch-to-zoom on touch (rotation is controlled by this)
          doubleClickZoom: true,
          scrollZoom: true,
          boxZoom: false,
          dragPan: true, // Allow panning
          keyboard: false,
          touchPitch: false,
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
      } catch (error) {
        console.error('[HomepageMapView] Error initializing map:', error);
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

  // Get live map ID for filtering mentions
  const [liveMapId, setLiveMapId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiveMapId = async () => {
      try {
        // Try slug first (new system)
        const { data: slugMap, error: slugError } = await supabase
          .from('map')
          .select('id')
          .eq('slug', 'live')
          .eq('is_active', true)
          .maybeSingle();
        
        if (slugMap && !slugError) {
          setLiveMapId(slugMap.id);
          return;
        }
        
        // Fallback to custom_slug (legacy)
        const { data: legacyMap, error: legacyError } = await supabase
          .from('map')
          .select('id')
          .eq('custom_slug', 'live')
          .eq('is_primary', true)
          .maybeSingle();
        
        if (legacyMap && !legacyError) {
          setLiveMapId(legacyMap.id);
        }
      } catch (error) {
        console.error('[HomepageMapView] Error fetching live map ID:', error);
      }
    };
    fetchLiveMapId();
  }, []);

  return (
    <div className="relative w-full bg-gray-100 rounded-lg border border-gray-200 overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Mentions Layer - No interactivity, just display */}
      {mapLoaded && mapInstanceRef.current && liveMapId && (
        <MentionsLayer
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          mapId={liveMapId}
          skipClickHandlers={true}
          clusterPins={false}
        />
      )}

      {/* Floating "See map" button */}
      <Link
        href="/live"
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors shadow-lg"
      >
        <MapIcon className="w-4 h-4" />
        <span>See map</span>
      </Link>
    </div>
  );
}
