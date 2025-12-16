'use client';

import { useState, useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { trackMapInfo, type MapInfo } from '../controllers/mapInfoController';

export interface UseMapInfoOptions {
  map: MapboxMap | null;
}

export interface UseMapInfoReturn {
  mapInfo: MapInfo;
  subscribe: (callback: (info: MapInfo) => void) => () => void;
}

/**
 * Hook for reactive map state tracking
 */
export function useMapInfo(options: UseMapInfoOptions): UseMapInfoReturn {
  const { map } = options;
  const [mapInfo, setMapInfo] = useState<MapInfo>({
    zoom: 5,
    center: { lat: 46.7296, lng: -94.6859 },
    cursor: { lat: 0, lng: 0 },
    bearing: 0,
    pitch: 0,
  });
  const subscriptionRef = useRef<ReturnType<typeof trackMapInfo> | null>(null);

  useEffect(() => {
    if (!map || map.removed) return;

    // Start tracking
    subscriptionRef.current = trackMapInfo({
      map,
      onUpdate: setMapInfo,
    });

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [map]);

  const subscribe = (callback: (info: MapInfo) => void): (() => void) => {
    // Simple subscription - just call callback when mapInfo changes
    const unsubscribe = () => {};
    // In a real implementation, you might want a more sophisticated subscription system
    return unsubscribe;
  };

  return { mapInfo, subscribe };
}



