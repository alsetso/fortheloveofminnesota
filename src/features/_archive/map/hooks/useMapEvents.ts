'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { registerMapEvents, unregisterMapEvents } from '../controllers/mapEventsController';

export interface UseMapEventsOptions {
  map: MapboxMap | null;
  markers: Map<string, Marker>;
  onMapClick?: (coordinates: { lat: number; lng: number }) => void;
}

export interface UseMapEventsReturn {
  // Event handlers are internal, no need to expose
  // Using Record to satisfy lint rules
  [key: string]: never;
}

/**
 * Hook for managing map event subscriptions
 */
export function useMapEvents(options: UseMapEventsOptions): UseMapEventsReturn {
  const { map, markers, onMapClick } = options;
  const handlersRef = useRef<ReturnType<typeof registerMapEvents> | null>(null);

  useEffect(() => {
    if (!map || map.removed) return;

    // Register events
    handlersRef.current = registerMapEvents({
      map,
      markers,
      onMapClick,
    });

    // Cleanup
    return () => {
      if (handlersRef.current) {
        unregisterMapEvents(handlersRef.current);
        handlersRef.current = null;
      }
    };
  }, [map, markers, onMapClick]);

  return {};
}



