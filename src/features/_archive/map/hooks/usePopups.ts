'use client';

import { useRef, useCallback } from 'react';
import type { Map as MapboxMap, Popup, Marker } from 'mapbox-gl';
import { createPopupController } from '../controllers/popupController';

export interface UsePopupsOptions {
  map: MapboxMap | null;
}

export interface UsePopupsReturn {
  setupPopupListeners: (popup: Popup, id: string) => void;
  createPopup: (content: string) => Promise<Popup>;
  updatePopupContent: (marker: Marker, content: string, id: string) => void;
  removePopup: (marker: Marker) => void;
}

/**
 * Hook for popup management
 */
export function usePopups(options: UsePopupsOptions): UsePopupsReturn {
  const { map } = options;
  const controllerRef = useRef<ReturnType<typeof createPopupController> | null>(
    null
  );

  // Initialize controller when map is available
  if (map && !map.removed && !controllerRef.current) {
    controllerRef.current = createPopupController(map);
  }

  const setupPopupListeners = useCallback((popup: Popup, id: string) => {
    if (!controllerRef.current) return;
    controllerRef.current.setupPopupListeners(popup, id);
  }, []);

  const createPopup = useCallback(
    (content: string): Popup => {
      if (!controllerRef.current) {
        throw new Error('Popup controller not initialized');
      }
      return controllerRef.current.createPopup(content);
    },
    []
  );

  const updatePopupContent = useCallback(
    (marker: Marker, content: string, id: string) => {
      if (!controllerRef.current) return;
      controllerRef.current.updatePopupContent(marker, content, id);
    },
    []
  );

  const removePopup = useCallback((marker: Marker) => {
    if (!controllerRef.current) return;
    controllerRef.current.removePopup(marker);
  }, []);

  return {
    setupPopupListeners,
    createPopup,
    updatePopupContent,
    removePopup,
  };
}

