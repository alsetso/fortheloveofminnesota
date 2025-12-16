'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pin, PinService } from '@/features/pins/services/pinService';
import { Area, AreaService } from '@/features/areas/services/areaService';
import { Tag, TagService } from '@/features/tags/services/tagService';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { filterPinsByVisibility, getVisibilityFilterContext } from '@/features/_archive/map/utils/visibilityFilter';

export interface MapDataFilters {
  tagIds?: string[];
  visibilityFilter?: {
    public: boolean;
    private: boolean;
  };
  profileId?: string | null;
}

export interface UseMapDataReturn {
  pins: Pin[];
  areas: Area[];
  tags: Tag[];
  isLoading: boolean;
  isInitialLoad: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  refreshPins: () => Promise<void>;
  refreshAreas: () => Promise<void>;
  refreshTags: () => Promise<void>;
}

export interface UseMapDataOptions {
  mapLoaded: boolean;
  filters?: MapDataFilters;
  autoLoad?: boolean;
}

/**
 * Unified hook for managing all map data (pins, areas, tags)
 * Provides single source of truth with coordinated loading
 */
export function useMapData({
  mapLoaded,
  filters,
  autoLoad = true,
}: UseMapDataOptions): UseMapDataReturn {
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  
  // Data state (raw pins before visibility filtering)
  const [rawPins, setRawPins] = useState<Pin[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs to track loading state and prevent duplicate loads
  const isLoadingRef = useRef(false);
  const lastLoadParamsRef = useRef<string>('');
  
  // Get visibility filter context
  const visibilityContext = useMemo(() => {
    const userProfileIds = selectedProfile ? [selectedProfile.id] : [];
    return getVisibilityFilterContext(userProfileIds, !!user);
  }, [selectedProfile, user]);
  
  // Apply visibility filtering to pins
  const pins = useMemo(() => {
    if (!filters?.visibilityFilter) {
      return rawPins;
    }
    return filterPinsByVisibility(rawPins, filters.visibilityFilter, visibilityContext);
  }, [rawPins, filters?.visibilityFilter, visibilityContext]);
  
  /**
   * Load pins with server-side filtering
   * Uses getPins() for better server-side filtering support
   */
  const loadPins = useCallback(async (): Promise<Pin[]> => {
    try {
      const tagIds = filters?.tagIds && filters.tagIds.length > 0 
        ? filters.tagIds 
        : undefined;
      
      // Use getPins() for better filtering support (supports bbox, visibility, etc.)
      // For now, we'll use getAllPins() but apply visibility filtering client-side
      // TODO: Move visibility filtering to server-side using getPins() with proper filters
      const loadedPins = await PinService.getAllPins(tagIds);
      
      // Filter valid pins (with coordinates)
      const validPins = loadedPins.filter(pin => {
        const lat = pin.lat;
        const lng = pin.lng ?? pin.long;
        return lat != null && lng != null && 
               typeof lat === 'number' && typeof lng === 'number' &&
               !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
      });
      
      return validPins;
    } catch (err) {
      console.error('Error loading pins:', err);
      throw new Error(`Failed to load pins: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [filters?.tagIds]);
  
  /**
   * Load areas
   */
  const loadAreas = useCallback(async (): Promise<Area[]> => {
    try {
      const loadedAreas = await AreaService.getAllAreas();
      return loadedAreas;
    } catch (err) {
      console.error('Error loading areas:', err);
      throw new Error(`Failed to load areas: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);
  
  /**
   * Load tags for pins
   */
  const loadTags = useCallback(async (): Promise<Tag[]> => {
    try {
      const loadedTags = await TagService.getPublicTagsByEntityType('pin');
      return loadedTags;
    } catch (err) {
      console.error('Error loading tags:', err);
      throw new Error(`Failed to load tags: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);
  
  /**
   * Load all map data in parallel
   */
  const loadAllData = useCallback(async () => {
    if (!mapLoaded || isLoadingRef.current) {
      return;
    }
    
    // Create a key from filters to detect changes
    const loadKey = JSON.stringify({
      tagIds: filters?.tagIds,
      profileId: selectedProfile?.id,
      visibility: filters?.visibilityFilter,
    });
    
    // Skip if same params and already loaded
    if (loadKey === lastLoadParamsRef.current && !isInitialLoad) {
      return;
    }
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      // Load all data in parallel for better performance
      const [loadedPins, loadedAreas, loadedTags] = await Promise.all([
        loadPins(),
        loadAreas(),
        loadTags(),
      ]);
      
      // Store raw pins (visibility filtering applied in useMemo)
      setRawPins(loadedPins);
      setAreas(loadedAreas);
      setTags(loadedTags);
      
      lastLoadParamsRef.current = loadKey;
      setIsInitialLoad(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load map data');
      setError(error);
      console.error('Error loading map data:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [mapLoaded, loadPins, loadAreas, loadTags, filters, selectedProfile?.id, isInitialLoad]);
  
  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    lastLoadParamsRef.current = ''; // Reset to force reload
    await loadAllData();
  }, [loadAllData]);
  
  /**
   * Refresh only pins
   */
  const refreshPins = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedPins = await loadPins();
      setRawPins(loadedPins);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh pins');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [loadPins]);
  
  /**
   * Refresh only areas
   */
  const refreshAreas = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedAreas = await loadAreas();
      setAreas(loadedAreas);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh areas');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAreas]);
  
  /**
   * Refresh only tags
   */
  const refreshTags = useCallback(async () => {
    try {
      const loadedTags = await loadTags();
      setTags(loadedTags);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh tags');
      setError(error);
    }
  }, [loadTags]);
  
  // Auto-load when map is ready and filters change
  useEffect(() => {
    if (autoLoad && mapLoaded) {
      loadAllData();
    }
  }, [autoLoad, mapLoaded, loadAllData]);
  
  // Reload when profile changes
  useEffect(() => {
    if (mapLoaded && selectedProfile?.id) {
      lastLoadParamsRef.current = ''; // Reset to force reload
      loadAllData();
    }
  }, [selectedProfile?.id, mapLoaded, loadAllData]);
  
  return {
    pins,
    areas,
    tags,
    isLoading,
    isInitialLoad,
    error,
    refresh,
    refreshPins,
    refreshAreas,
    refreshTags,
  };
}

