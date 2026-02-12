'use client';

import { useState, useEffect, useRef } from 'react';
import { generateUUID } from '@/lib/utils/uuid';
import type { MapData } from '@/types/map';

interface UseMapPageDataOptions {
  mapId: string | null;
  /** When provided (e.g. for /maps), skip fetch and use this data */
  initialData?: {
    map: MapData;
    pins?: any[];
    areas?: any[];
    members?: any[] | null;
    tags?: { id: string; emoji: string; name: string }[];
  } | null;
}

interface MapPageDataState {
  mapData: MapData | null;
  loading: boolean;
  error: string | null;
  viewCount: number;
  initialPins: any[];
  initialAreas: any[];
  initialMembers: any[] | null;
  tags: { id: string; emoji: string; name: string }[];
}

/**
 * Hook to manage map page data fetching and state
 * Consolidates map data, loading, error, view count, and initial pins/areas/members
 */
export function useMapPageData({ mapId, initialData }: UseMapPageDataOptions) {
  const [state, setState] = useState<MapPageDataState>({
    mapData: initialData?.map ?? null,
    loading: !initialData,
    error: null,
    viewCount: 0,
    initialPins: initialData?.pins ?? [],
    initialAreas: initialData?.areas ?? [],
    initialMembers: initialData?.members ?? null,
    tags: initialData?.tags ?? [],
  });
  
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const hasRecordedViewRef = useRef(false);

  // Update map data (for settings updates)
  const updateMapData = (updated: Partial<MapData>) => {
    setState((prev) => ({
      ...prev,
      mapData: prev.mapData ? { ...prev.mapData, ...updated } : null,
    }));
  };

  // When initialData provided, use it and skip fetch
  useEffect(() => {
    if (initialData) {
      setState((prev) => ({
        ...prev,
        mapData: initialData.map,
        loading: false,
        initialPins: initialData.pins ?? [],
        initialAreas: initialData.areas ?? [],
        initialMembers: initialData.members ?? null,
        tags: initialData.tags ?? [],
      }));
      return;
    }
  }, [initialData]);

  // Fetch all map data in one call - runs once per mapId (skip when initialData)
  useEffect(() => {
    if (initialData) return;
    if (!mapId) {
      setState({
        mapData: null,
        loading: false,
        error: null,
        viewCount: 0,
        initialPins: [],
        initialAreas: [],
        initialMembers: null,
        tags: [],
      });
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Single aggregate endpoint: map + stats + pins + areas + members
        const response = await fetch(`/api/maps/${mapId}/data`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 404) {
            setState((prev) => ({ ...prev, loading: false, error: 'Map not found' }));
          } else if (response.status === 403) {
            setState((prev) => ({ ...prev, loading: false, error: 'You do not have access to this map' }));
          } else {
            setState((prev) => ({ ...prev, loading: false, error: data.error || 'Failed to load map' }));
          }
          return;
        }

        // Validate response structure
        if (!data || typeof data !== 'object' || !data.map) {
          throw new Error('Invalid map data received');
        }
        
        const map: MapData = data.map;
        
        setState({
          mapData: map,
          loading: false,
          error: null,
          viewCount: data.stats?.stats?.total_views || 0,
          initialPins: data.pins || [],
          initialAreas: data.areas || [],
          initialMembers: data.members || null,
          tags: data.tags || [],
        });

        // Record view (fire and forget) - only once per map (skip for public/live - no UUID)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(map.id));
        if (!hasRecordedViewRef.current && map.id && isUuid) {
          hasRecordedViewRef.current = true;
          setHasRecordedView(true);
          
          let sessionId: string | null = null;
          if (typeof window !== 'undefined') {
            sessionId = localStorage.getItem('analytics_device_id') || generateUUID();
            if (!localStorage.getItem('analytics_device_id')) {
              localStorage.setItem('analytics_device_id', sessionId);
            }
          }
          
          fetch('/api/analytics/map-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              map_id: map.id,
              referrer_url: typeof window !== 'undefined' ? document.referrer || null : null,
              session_id: sessionId,
              user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
            }),
          }).catch(() => {
            // Silently fail - view recording is not critical
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching map:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load map',
        }));
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [mapId]);

  // Reset view recording flag when mapId changes
  useEffect(() => {
    hasRecordedViewRef.current = false;
    setHasRecordedView(false);
  }, [mapId]);

  return {
    ...state,
    updateMapData,
    hasRecordedView,
  };
}
