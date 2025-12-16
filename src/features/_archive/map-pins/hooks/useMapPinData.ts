'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, MapPinService, MapPinFilters } from '../services/mapPinService';

export interface UseMapPinDataOptions {
  mapLoaded: boolean;
  filters?: MapPinFilters;
  autoLoad?: boolean;
}

export interface UseMapPinDataReturn {
  pins: MapPin[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Simple hook for loading pins for the map page
 */
export function useMapPinData({
  mapLoaded,
  filters,
  autoLoad = true,
}: UseMapPinDataOptions): UseMapPinDataReturn {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => filters, [
    filters?.tagIds?.join(','),
    filters?.profileId,
    filters?.visibility?.public,
    filters?.visibility?.private,
  ]);

  const loadPins = useCallback(async () => {
    // Map pins fetching has been disabled
    setPins([]);
    setIsLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const refresh = useCallback(async () => {
    await loadPins();
  }, [loadPins]);

  return {
    pins,
    isLoading,
    error,
    refresh,
  };
}

