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
      console.log('[AtlasLayer] Layer hidden, clearing visible tables');
      setVisibleTables([]);
      return;
    }

    const fetchAtlasTypes = async () => {
      console.log('[AtlasLayer] Fetching active atlas types...');
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
          console.log('[AtlasLayer] Active atlas types fetched:', {
            count: activeSlugs.length,
            tables: activeSlugs,
            types: types,
          });
          setVisibleTables(activeSlugs);
        } else {
          console.warn('[AtlasLayer] No active atlas types found');
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
        console.log('[AtlasLayer] Visibility changed via event:', {
          previousTables: visibleTables,
          newTables: tables,
          turningOn: tables.filter(t => !visibleTables.includes(t)),
          turningOff: visibleTables.filter(t => !tables.includes(t)),
        });
        setVisibleTables(tables);
      } else {
        console.warn('[AtlasLayer] Invalid visibleTables in event:', event.detail);
      }
    };

    window.addEventListener('atlas-visibility-change', handleVisibilityChange as EventListener);

    return () => {
      window.removeEventListener('atlas-visibility-change', handleVisibilityChange as EventListener);
    };
  }, [visible, visibleTables]);

  if (!map || !mapLoaded || !visible || visibleTables.length === 0) {
    return null;
  }

  return <AtlasEntitiesLayer map={map} mapLoaded={mapLoaded} visibleTables={visibleTables} onEntityClick={onEntityClick} />;
}
