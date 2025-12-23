'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface AtlasEntity {
  id: string;
  name: string;
  city_id: string | null;
  emoji: string;
  lat: number;
  lng: number;
  table_name: string;
}

interface AtlasEntitiesLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  visibleTables: string[];
}

const ENTITY_ICONS: Record<string, string> = {
  neighborhoods: '🏘️',
  schools: '🎓',
  parks: '🌳',
  lakes: '💧',
  watertowers: '🗼',
  cemeteries: '🪦',
  golf_courses: '⛳',
  hospitals: '🏥',
  airports: '✈️',
  churches: '⛪',
  municipals: '🏛️',
  roads: '🛣️',
  radio_and_news: '📻',
};

/**
 * AtlasEntitiesLayer component manages Mapbox atlas entity visualization
 * Renders entities from the unified atlas_entities view (or all_entities if atlas_entities doesn't exist)
 */
export default function AtlasEntitiesLayer({ 
  map, 
  mapLoaded, 
  visibleTables 
}: AtlasEntitiesLayerProps) {
  const sourceId = 'atlas-entities';
  const pointLayerId = 'atlas-entities-point';
  const pointLabelLayerId = 'atlas-entities-point-label';
  
  const entitiesRef = useRef<AtlasEntity[]>([]);
  const isAddingLayersRef = useRef<boolean>(false);
  const clickHandlersAddedRef = useRef<boolean>(false);

  // Fetch atlas entities and add to map
  useEffect(() => {
    if (!map || !mapLoaded || visibleTables.length === 0) {
      // Remove layers if no tables are visible
      const mapboxMap = map as any;
      try {
        if (mapboxMap.getLayer(pointLabelLayerId)) {
          mapboxMap.removeLayer(pointLabelLayerId);
        }
        if (mapboxMap.getLayer(pointLayerId)) {
          mapboxMap.removeLayer(pointLayerId);
        }
        if (mapboxMap.getSource(sourceId)) {
          mapboxMap.removeSource(sourceId);
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
      return;
    }

    let mounted = true;

    const loadEntities = async () => {
      if (isAddingLayersRef.current) return;
      
      try {
        // Try atlas_entities first (has lat/lng/table_name), fallback to all_entities if needed
        const { data, error } = await supabase
          .from('atlas_entities')
          .select('id, name, city_id, emoji, lat, lng, table_name')
          .in('table_name', visibleTables)
          .not('lat', 'is', null)
          .not('lng', 'is', null);

        if (error) {
          console.error('[AtlasEntitiesLayer] Error fetching entities:', error);
          return;
        }

        if (!mounted) return;

        entitiesRef.current = (data || []) as AtlasEntity[];

        // Convert to GeoJSON
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: entitiesRef.current.map((entity) => ({
            type: 'Feature' as const,
            id: entity.id,
            geometry: {
              type: 'Point' as const,
              coordinates: [Number(entity.lng), Number(entity.lat)],
            },
            properties: {
              id: entity.id,
              name: entity.name,
              city_id: entity.city_id,
              table_name: entity.table_name,
              emoji: entity.emoji,
            },
          })),
        };

        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasEntitiesLayer] Loaded entities:', entitiesRef.current.length);
        }

        isAddingLayersRef.current = true;
        const mapboxMap = map as any;

        // Check if source already exists
        try {
          const existingSource = map.getSource(sourceId);
          if (existingSource && existingSource.type === 'geojson') {
            existingSource.setData(geoJSON);
            isAddingLayersRef.current = false;
            return;
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AtlasEntitiesLayer] Error checking existing source:', e);
          }
        }

        // Clean up existing layers
        try {
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            mapboxMap.removeLayer(pointLabelLayerId);
          }
          if (mapboxMap.getLayer(pointLayerId)) {
            mapboxMap.removeLayer(pointLayerId);
          }
          if (mapboxMap.getSource(sourceId)) {
            mapboxMap.removeSource(sourceId);
          }
        } catch (e) {
          // Ignore cleanup errors
        }

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });

        // Add point layer
        mapboxMap.addLayer({
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': 6,
            'circle-color': '#3b82f6',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8,
          },
        });

        // Add label layer
        mapboxMap.addLayer({
          id: pointLabelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });

        isAddingLayersRef.current = false;

        // Add click handler
        if (!clickHandlersAddedRef.current) {
          mapboxMap.on('click', pointLayerId, (e: any) => {
            const feature = e.features?.[0];
            if (feature) {
              const props = feature.properties;
              // Dispatch custom event for entity click
              window.dispatchEvent(new CustomEvent('atlas-entity-click', {
                detail: {
                  id: props.id,
                  name: props.name,
                  table_name: props.table_name,
                  city_id: props.city_id,
                  emoji: props.emoji,
                  lat: e.lngLat.lat,
                  lng: e.lngLat.lng,
                },
              }));
            }
          });

          // Change cursor on hover
          mapboxMap.on('mouseenter', pointLayerId, () => {
            mapboxMap.getCanvas().style.cursor = 'pointer';
          });

          mapboxMap.on('mouseleave', pointLayerId, () => {
            mapboxMap.getCanvas().style.cursor = '';
          });

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        console.error('[AtlasEntitiesLayer] Error loading entities:', error);
        isAddingLayersRef.current = false;
      }
    };

    loadEntities();

    return () => {
      mounted = false;
    };
  }, [map, mapLoaded, visibleTables]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      const mapboxMap = map as any;
      try {
        if (mapboxMap.getLayer(pointLabelLayerId)) {
          mapboxMap.removeLayer(pointLabelLayerId);
        }
        if (mapboxMap.getLayer(pointLayerId)) {
          mapboxMap.removeLayer(pointLayerId);
        }
        if (mapboxMap.getSource(sourceId)) {
          mapboxMap.removeSource(sourceId);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [map]);

  return null;
}
