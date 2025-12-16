'use client';

import { useState, useCallback } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { changeMapStyle, getAvailableStyles } from '../controllers/styleController';
import { MAP_CONFIG } from '../config';

export interface UseMapStyleOptions {
  map: MapboxMap | null;
}

export interface UseMapStyleReturn {
  currentStyle: keyof typeof MAP_CONFIG.STRATEGIC_STYLES;
  changeStyle: (
    styleKey: keyof typeof MAP_CONFIG.STRATEGIC_STYLES
  ) => Promise<void>;
  availableStyles: Array<{
    key: keyof typeof MAP_CONFIG.STRATEGIC_STYLES;
    url: string;
  }>;
}

/**
 * Hook for map style switching
 */
export function useMapStyle(options: UseMapStyleOptions): UseMapStyleReturn {
  const { map } = options;
  const [currentStyle, setCurrentStyle] =
    useState<keyof typeof MAP_CONFIG.STRATEGIC_STYLES>('streets');

  const changeStyle = useCallback(
    async (styleKey: keyof typeof MAP_CONFIG.STRATEGIC_STYLES) => {
      if (!map || map.removed) {
        throw new Error('Map not initialized');
      }
      await changeMapStyle(map, styleKey);
      setCurrentStyle(styleKey);
    },
    [map]
  );

  const availableStyles = getAvailableStyles();

  return {
    currentStyle,
    changeStyle,
    availableStyles,
  };
}



