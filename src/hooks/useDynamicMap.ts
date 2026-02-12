import { useState, useEffect } from 'react';
import { parseMapIdentifier, shouldRenderMap } from '@/lib/maps/getMapByIdentifier';

export interface DynamicMap {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  visibility: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DynamicPin {
  id: string;
  map_id: string;
  lat: number | null;
  lng: number | null;
  body: string;
  caption: string | null;
  emoji: string | null;
  image_url: string | null;
  video_url: string | null;
  icon_url: string | null;
  media_type: string;
  full_address: string | null;
  view_count: number;
  visibility: string;
  author_account_id: string | null;
  account_id: string | null;
  account: {
    image_url: string | null;
  } | null;
  mention_type: {
    id: string;
    emoji: string | null;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface UseDynamicMapOptions {
  identifier: string; // ID or slug
  autoLoad?: boolean; // Auto-load map and pins on mount
  pinsLimit?: number; // Limit for pins query
  pinsVisibility?: 'public' | 'only_me'; // Filter pins by visibility
}

interface UseDynamicMapResult {
  map: DynamicMap | null;
  pins: DynamicPin[];
  loading: boolean;
  error: string | null;
  loadMap: () => Promise<void>;
  loadPins: () => Promise<void>;
  shouldRender: boolean;
}

/**
 * Simple hook to load a map and its pins by ID or slug
 */
export function useDynamicMap(options: UseDynamicMapOptions): UseDynamicMapResult {
  const { identifier, autoLoad = true, pinsLimit = 100, pinsVisibility = 'public' } = options;
  
  const [map, setMap] = useState<DynamicMap | null>(null);
  const [pins, setPins] = useState<DynamicPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadMap = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/maps/dynamic/${identifier}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load map: ${response.statusText}`);
      }
      
      const data = await response.json();
      setMap(data.map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map');
      setMap(null);
    } finally {
      setLoading(false);
    }
  };
  
  const loadPins = async () => {
    if (!map) {
      setError('Map must be loaded before loading pins');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        limit: pinsLimit.toString(),
        visibility: pinsVisibility,
      });
      
      const response = await fetch(`/api/maps/dynamic/${identifier}/pins?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load pins: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPins(data.pins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pins');
      setPins([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (autoLoad && identifier) {
      loadMap().then(() => {
        // Auto-load pins after map loads
        if (map) {
          loadPins();
        }
      });
    }
  }, [identifier, autoLoad]);
  
  // Auto-load pins when map changes
  useEffect(() => {
    if (map && autoLoad) {
      loadPins();
    }
  }, [map?.id]);
  
  const shouldRender = shouldRenderMap(map);
  
  return {
    map,
    pins,
    loading,
    error,
    loadMap,
    loadPins,
    shouldRender,
  };
}
