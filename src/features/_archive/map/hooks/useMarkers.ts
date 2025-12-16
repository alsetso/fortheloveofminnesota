'use client';

import { useRef, useCallback } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { createMarkerController } from '../controllers/markerController';

export interface UseMarkersOptions {
  map: MapboxMap | null;
  onPopupCreate?: (popup: import('mapbox-gl').Popup, markerId: string) => void;
}

export interface UseMarkersReturn {
  addMarker: (
    id: string,
    coordinates: { lat: number; lng: number },
    options?: {
      color?: string;
      element?: HTMLElement;
      popupContent?: string;
    }
  ) => Promise<void>;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  updateMarker: (
    id: string,
    coordinates?: { lat: number; lng: number },
    options?: { element?: HTMLElement }
  ) => void;
  getMarker: (id: string) => Marker | undefined;
  markers: Map<string, Marker>;
}

/**
 * Hook for marker management
 */
export function useMarkers(options: UseMarkersOptions): UseMarkersReturn {
  const { map, onPopupCreate } = options;
  const controllerRef = useRef<ReturnType<typeof createMarkerController> | null>(
    null
  );

  // Initialize controller when map is available
  if (map && !map.removed && !controllerRef.current) {
    controllerRef.current = createMarkerController(map);
  }

  const addMarker = useCallback(
    async (
      id: string,
      coordinates: { lat: number; lng: number },
      options?: {
        color?: string;
        element?: HTMLElement;
        popupContent?: string;
      }
    ) => {
      if (!controllerRef.current) return;
      await controllerRef.current.createMarker(id, coordinates, {
        ...options,
        onPopupCreate,
      });
    },
    [onPopupCreate]
  );

  const removeMarker = useCallback((id: string) => {
    if (!controllerRef.current) return;
    controllerRef.current.removeMarker(id);
  }, []);

  const clearMarkers = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.clearAllMarkers();
  }, []);

  const updateMarker = useCallback(
    (
      id: string,
      coordinates?: { lat: number; lng: number },
      options?: { element?: HTMLElement }
    ) => {
      if (!controllerRef.current) return;
      controllerRef.current.updateMarker(id, coordinates, options);
    },
    []
  );

  const getMarker = useCallback(
    (id: string): Marker | undefined => {
      if (!controllerRef.current) return undefined;
      return controllerRef.current.getMarker(id);
    },
    []
  );

  const markers = controllerRef.current?.getMarkers() || new Map<string, Marker>();

  return {
    addMarker,
    removeMarker,
    clearMarkers,
    updateMarker,
    getMarker,
    markers,
  };
}



