'use client';

import { useState, useEffect, useRef } from 'react';
import { generateUUID } from '@/lib/utils/uuid';
import type { MapData } from '@/types/map';

interface UseMapPageDataOptions {
  mapId: string | null;
}

interface MapPageDataState {
  mapData: MapData | null;
  loading: boolean;
  error: string | null;
  viewCount: number;
  initialPins: any[];
  initialAreas: any[];
  initialMembers: any[] | null;
}

/**
 * Hook to manage map page data fetching and state
 * Consolidates map data, loading, error, view count, and initial pins/areas/members
 */
export function useMapPageData({ mapId }: UseMapPageDataOptions) {
  const [state, setState] = useState<MapPageDataState>({
    mapData: null,
    loading: true,
    error: null,
    viewCount: 0,
    initialPins: [],
    initialAreas: [],
    initialMembers: null,
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

  // Fetch all map data in one call - runs once per mapId
  useEffect(() => {
    if (!mapId) {
      setState({
        mapData: null,
        loading: false,
        error: null,
        viewCount: 0,
        initialPins: [],
        initialAreas: [],
        initialMembers: null,
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
        });

        // Record view (fire and forget) - only once per map
        if (!hasRecordedViewRef.current && map.id) {
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
