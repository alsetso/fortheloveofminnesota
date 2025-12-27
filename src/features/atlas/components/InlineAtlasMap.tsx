'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface InlineAtlasMapProps {
  height?: string;
  className?: string;
}

export default function InlineAtlasMap({ 
  height = '400px',
  className = '',
}: InlineAtlasMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);

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
          pitch: 0,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setTimeout(() => {
              if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                mapInstance.resize();
              }
            }, 100);
            setMapLoaded(true);
          }
        });

        mapInstance.on('error', (e: unknown) => {
          const errorMessage = e instanceof Error 
            ? e.message 
            : typeof e === 'object' && e !== null && 'error' in e
            ? String((e as any).error)
            : typeof e === 'string'
            ? e
            : 'Unknown map error';
          
          console.error('[InlineAtlasMap] Map error:', errorMessage);
          if (mounted) {
            setMapError('load-error');
          }
        });
      } catch (err) {
        console.error('Failed to initialize map:', err);
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
          if (!mapInstanceRef.current.removed) {
            mapInstanceRef.current.remove();
          }
        } catch {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative w-full border border-gray-200 rounded-md overflow-hidden bg-gray-50 ${className}`} style={{ height }}>
      {/* Mapbox Container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full"
        style={{ margin: 0, padding: 0, minHeight: height }}
      />

      {/* Floating "View Live Map" Button */}
      {mapLoaded && (
        <Link
          href="/"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-xs font-medium transition-colors shadow-lg"
        >
          View Live Map
        </Link>
      )}

      {/* Loading/Error Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            {mapError === 'missing-token' ? (
              <div className="bg-white border-2 border-red-500 rounded-lg p-4 max-w-md mx-4">
                <div className="text-red-600 font-bold text-sm mb-2">⚠️ Mapbox Token Missing</div>
                <div className="text-gray-700 text-xs">
                  Please set <code className="bg-gray-100 px-2 py-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in your <code className="bg-gray-100 px-2 py-1 rounded text-xs">.env.local</code> file.
                </div>
              </div>
            ) : mapError ? (
              <div className="bg-white border-2 border-red-500 rounded-lg p-4 max-w-md mx-4">
                <div className="text-red-600 font-bold text-sm mb-2">⚠️ Map Error</div>
                <div className="text-gray-700 text-xs">
                  Failed to initialize the map. Check browser console for details.
                </div>
              </div>
            ) : (
              <>
                <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <div className="text-gray-600 text-xs font-medium">Loading map...</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

