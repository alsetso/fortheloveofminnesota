'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAP_CONFIG } from '@/features/map/config';

interface HomepageStats {
  last24Hours: {
    totalViews: number;
    uniqueVisitors: number;
  };
  allTime: {
    totalViews: number;
    uniqueVisitors: number;
  };
}

export default function HomepageMapPreview() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const router = useRouter();

  // Fetch homepage stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/homepage-stats');
        if (response.ok) {
          const data = await response.json();
          setStats({
            last24Hours: {
              totalViews: data.last24Hours?.total_views || 0,
              uniqueVisitors: data.last24Hours?.unique_visitors || 0,
            },
            allTime: {
              totalViews: data.allTime?.total_views || 0,
              uniqueVisitors: data.allTime?.unique_visitors || 0,
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch homepage stats:', error);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

    // Minnesota bounds
    const minnesotaBounds = [
      [-97.5, 43.5], // Southwest corner
      [-89.5, 49.5], // Northeast corner
    ] as [[number, number], [number, number]];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_CONFIG.MAPBOX_STYLE,
      center: [-93.273945, 45.045283], // Minnesota center
      zoom: 7,
      interactive: true,
      attributionControl: false,
      maxBounds: minnesotaBounds, // Constrain to Minnesota
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[400px] rounded-md overflow-hidden border border-gray-200">
      {/* Mapbox Container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full"
      />

      {/* Live Indicator - Top Left */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="relative">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
        </div>
        <span className="text-xs font-semibold text-white drop-shadow-lg">LIVE</span>
      </div>

      {/* Stats Overlay - Center */}
      {stats && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 text-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-md px-4 py-3 border border-gray-200 shadow-lg">
            <div className="text-xs text-gray-600 mb-1">Total Homepage Visits</div>
            <div className="text-lg font-semibold text-gray-900">{stats.allTime.totalViews.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              {stats.last24Hours.totalViews.toLocaleString()} visitors today
            </div>
          </div>
        </div>
      )}

      {/* View Map Button - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
        <button
          onClick={() => router.push('/live')}
          className="pointer-events-auto px-4 py-2 text-xs font-semibold text-gray-900 bg-white/90 backdrop-blur-sm hover:bg-white rounded-md transition-colors border border-gray-200 shadow-lg"
        >
          View Map
        </button>
      </div>
    </div>
  );
}

