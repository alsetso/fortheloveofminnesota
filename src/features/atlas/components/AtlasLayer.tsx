'use client';

import { useState, useEffect } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import AtlasEntitiesLayer from './AtlasEntitiesLayer';

interface AtlasLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible?: boolean;
  onEntityClick?: (entity: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  }) => void;
}

export default function AtlasLayer({ map, mapLoaded, visible = true, onEntityClick }: AtlasLayerProps) {
  const [visibleTables, setVisibleTables] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      setVisibleTables([]);
      return;
    }

    const fetchAtlasTypes = async () => {
      try {
        const { data: types, error } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .select('slug, status')
          .eq('is_visible', true)
          .eq('status', 'active')
          .order('display_order', { ascending: true });

        if (error) {
          console.error('[AtlasLayer] Error fetching atlas types:', error);
          return;
        }

        if (types && types.length > 0) {
          const activeSlugs = types.map((type: { slug: string }) => type.slug);
          setVisibleTables(activeSlugs);
        }
      } catch (error) {
        console.error('[AtlasLayer] Error fetching atlas types:', error);
      }
    };

    fetchAtlasTypes();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const handleVisibilityChange = (event: CustomEvent) => {
      const { visibleTables: tables } = event.detail;
      if (Array.isArray(tables)) {
        setVisibleTables(tables);
      }
    };

    window.addEventListener('atlas-visibility-change', handleVisibilityChange as EventListener);

    return () => {
      window.removeEventListener('atlas-visibility-change', handleVisibilityChange as EventListener);
    };
  }, [visible]);

  if (!map || !mapLoaded || !visible || visibleTables.length === 0) {
    return null;
  }

  return <AtlasEntitiesLayer map={map} mapLoaded={mapLoaded} visibleTables={visibleTables} onEntityClick={onEntityClick} />;
}
