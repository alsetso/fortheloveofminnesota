'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type {
  MapSelection,
  LocationData,
  PinData,
  AtlasEntity,
  FeatureMetadata,
  UseMapSelectionReturn,
  Coordinates,
} from '../types';

/**
 * URL-based map selection state management
 * 
 * Enables:
 * - Shareable links to specific pins, locations, entities
 * - Browser back/forward navigation
 * - Deep linking from external sources
 * - SSR-ready state initialization
 * 
 * URL patterns:
 * - /feed?sel=location&lat=44.9778&lng=-93.2650
 * - /feed?sel=pin&id=abc123
 * - /feed?sel=entity&type=city&id=xyz789
 */

// Cache for fetched data to avoid re-fetching on URL changes
const selectionCache = new Map<string, PinData | AtlasEntity>();

export function useMapSelection(): UseMapSelectionReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse selection from URL
  const selection = useMemo((): MapSelection => {
    const sel = searchParams.get('sel');
    
    if (!sel) {
      return { type: 'none' };
    }

    switch (sel) {
      case 'location': {
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');
        const address = searchParams.get('address');
        const placeName = searchParams.get('place');
        
        if (lat && lng) {
          const coordinates: Coordinates = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
          };
          
          // Validate coordinates
          if (isNaN(coordinates.lat) || isNaN(coordinates.lng)) {
            return { type: 'none' };
          }
          
          const data: LocationData = {
            coordinates,
            address: address || undefined,
            placeName: placeName || undefined,
            type: 'map-click',
          };
          
          return { type: 'location', data };
        }
        return { type: 'none' };
      }
      
      case 'pin': {
        const pinId = searchParams.get('id');
        if (pinId) {
          // Check cache first
          const cached = selectionCache.get(`pin:${pinId}`);
          if (cached && 'created_at' in cached) {
            return { type: 'pin', data: cached as PinData };
          }
          
          // Return placeholder - actual data should be fetched by component
          // This enables URL-based navigation before data loads
          return {
            type: 'pin',
            data: {
              id: pinId,
              name: '',
              coordinates: { lat: 0, lng: 0 },
              created_at: '',
            },
          };
        }
        return { type: 'none' };
      }
      
      case 'entity': {
        const entityId = searchParams.get('id');
        const entityType = searchParams.get('type');
        
        if (entityId && entityType) {
          // Check cache first
          const cached = selectionCache.get(`entity:${entityType}:${entityId}`);
          if (cached && 'layerType' in cached) {
            return { type: 'atlas_entity', data: cached as AtlasEntity };
          }
          
          // Return placeholder
          return {
            type: 'atlas_entity',
            data: {
              id: entityId,
              name: '',
              layerType: entityType as AtlasEntity['layerType'],
              emoji: '',
              lat: 0,
              lng: 0,
            },
          };
        }
        return { type: 'none' };
      }
      
      default:
        return { type: 'none' };
    }
  }, [searchParams]);

  // Helper to update URL params
  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    
    // Clear existing selection params
    ['sel', 'lat', 'lng', 'address', 'place', 'id', 'type'].forEach(key => {
      newParams.delete(key);
    });
    
    // Set new params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null) {
        newParams.set(key, value);
      }
    });
    
    const queryString = newParams.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    // Use replace to avoid polluting history with every click
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Selection actions
  const selectLocation = useCallback((data: LocationData, feature?: FeatureMetadata) => {
    const params: Record<string, string | null> = {
      sel: 'location',
      lat: data.coordinates.lat.toFixed(6),
      lng: data.coordinates.lng.toFixed(6),
    };
    
    if (data.address) {
      params.address = data.address;
    }
    if (data.placeName) {
      params.place = data.placeName;
    }
    
    updateUrl(params);
  }, [updateUrl]);

  const selectPin = useCallback((data: PinData) => {
    // Cache the pin data
    selectionCache.set(`pin:${data.id}`, data);
    
    updateUrl({
      sel: 'pin',
      id: data.id,
    });
  }, [updateUrl]);

  const selectAtlasEntity = useCallback((data: AtlasEntity) => {
    // Cache the entity data
    selectionCache.set(`entity:${data.layerType}:${data.id}`, data);
    
    updateUrl({
      sel: 'entity',
      id: data.id,
      type: data.layerType,
    });
  }, [updateUrl]);

  const clearSelection = useCallback(() => {
    updateUrl({ sel: null });
  }, [updateUrl]);

  // Derived state
  const isExpanded = selection.type !== 'none';

  return {
    selection,
    selectLocation,
    selectPin,
    selectAtlasEntity,
    clearSelection,
    isExpanded,
  };
}

/**
 * Update cached selection data
 * Call this after fetching full pin/entity data from the server
 */
export function updateSelectionCache(
  type: 'pin' | 'entity',
  id: string,
  data: PinData | AtlasEntity,
  entityType?: string
) {
  if (type === 'pin') {
    selectionCache.set(`pin:${id}`, data);
  } else if (entityType) {
    selectionCache.set(`entity:${entityType}:${id}`, data);
  }
}

/**
 * Clear the selection cache
 * Call this on logout or when data may be stale
 */
export function clearSelectionCache() {
  selectionCache.clear();
}





