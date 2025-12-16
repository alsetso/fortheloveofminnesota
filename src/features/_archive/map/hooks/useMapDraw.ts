'use client';

import { useRef, useState, useCallback } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { createDrawController } from '../controllers/drawController';

export interface UseMapDrawOptions {
  map: MapboxMap | null;
}

export interface UseMapDrawReturn {
  draw: ReturnType<typeof createDrawController> | null;
  drawMode: string;
  setDrawMode: (mode: string) => void;
  clearDraw: () => void;
  getFeatures: () => GeoJSON.FeatureCollection;
  initialize: () => Promise<void>;
}

/**
 * Hook for drawing functionality
 */
export function useMapDraw(options: UseMapDrawOptions): UseMapDrawReturn {
  const { map } = options;
  const [drawMode, setDrawModeState] = useState<string>('simple_select');
  const controllerRef = useRef<ReturnType<typeof createDrawController> | null>(
    null
  );

  // Initialize controller when map is available
  if (map && !map.removed && !controllerRef.current) {
    controllerRef.current = createDrawController(map);
  }

  const initialize = useCallback(async () => {
    if (!controllerRef.current) return;
    await controllerRef.current.initializeDraw();
  }, []);

  const setDrawMode = useCallback(
    (mode: string) => {
      if (!controllerRef.current) return;
      controllerRef.current.setDrawMode(mode);
      setDrawModeState(mode);
    },
    []
  );

  const clearDraw = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.clearDraw();
  }, []);

  const getFeatures = useCallback((): GeoJSON.FeatureCollection => {
    if (!controllerRef.current) {
      return { type: 'FeatureCollection', features: [] };
    }
    return controllerRef.current.getDrawnFeatures();
  }, []);

  return {
    draw: controllerRef.current,
    drawMode,
    setDrawMode,
    clearDraw,
    getFeatures,
    initialize,
  };
}



