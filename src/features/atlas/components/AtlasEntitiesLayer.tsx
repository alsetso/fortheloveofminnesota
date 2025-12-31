'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import {
  buildAtlasTextColorExpression,
  buildAtlasIconLayout,
  buildAtlasCirclePaint,
  buildAtlasLabelLayout,
} from '@/features/map/config/layerStyles';

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
  onEntityClick?: (entity: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  }) => void;
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
  visibleTables,
  onEntityClick
}: AtlasEntitiesLayerProps) {
  const sourceId = 'atlas-entities';
  const pointLayerId = 'atlas-entities-point';
  const pointLabelLayerId = 'atlas-entities-point-label';
  
  const entitiesRef = useRef<AtlasEntity[]>([]);
  const isAddingLayersRef = useRef<boolean>(false);
  const clickHandlersAddedRef = useRef<boolean>(false);
  const iconPathsRef = useRef<Record<string, string>>({});
  const iconsLoadedRef = useRef<Set<string>>(new Set());

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
        // Fetch icon paths from atlas_types
        const { data: typesData, error: typesError } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .select('slug, icon_path')
          .in('slug', visibleTables)
          .not('icon_path', 'is', null);

        if (!typesError && typesData) {
          typesData.forEach((type: { slug: string; icon_path: string }) => {
            iconPathsRef.current[type.slug] = type.icon_path;
          });
        }

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

        // Check if source and layers already exist (skip after style change)
        try {
          const existingSource = map.getSource(sourceId);
          const hasPointLayer = mapboxMap.getLayer(pointLayerId);
          const hasLabelLayer = mapboxMap.getLayer(pointLabelLayerId);
          
          if (existingSource && existingSource.type === 'geojson' && hasPointLayer && hasLabelLayer) {
            // Source and layers exist, just update data
            (existingSource as any).setData(geoJSON);
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

        // Load icons before adding layers
        const uniqueTables = [...new Set(entitiesRef.current.map(e => e.table_name))];
        const iconLoadPromises = uniqueTables.map(async (tableName) => {
          const iconPath = iconPathsRef.current[tableName];
          if (!iconPath) return;

          const imageId = `atlas-icon-${tableName}`;
          // Always check if image exists in Mapbox (may have been removed on style change)
          if (mapboxMap.hasImage(imageId)) {
            iconsLoadedRef.current.add(tableName);
            return;
          }
          
          // Skip if we've already loaded this icon in this session (unless cleared)
          if (iconsLoadedRef.current.has(tableName)) {
            return;
          }

          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = iconPath;
            });

            // Create canvas to resize image to 32x32 for map pins
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, 32, 32);
              
              const imageData = ctx.getImageData(0, 0, 32, 32);
              mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
              iconsLoadedRef.current.add(tableName);
            }
          } catch (error) {
            console.warn(`[AtlasEntitiesLayer] Failed to load icon for ${tableName}:`, error);
          }
        });

        await Promise.all(iconLoadPromises);

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });

        // Build icon-image expression based on available icons
        const tablesWithIcons = uniqueTables.filter(
          (tableName) => iconPathsRef.current[tableName] && iconsLoadedRef.current.has(tableName)
        );

        let iconImageLayout: any = {};
        
        if (tablesWithIcons.length > 0) {
          // Build case expression for icon selection
          const iconExpression: any[] = ['case'];
          tablesWithIcons.forEach((tableName) => {
            iconExpression.push(['==', ['get', 'table_name'], tableName]);
            iconExpression.push(`atlas-icon-${tableName}`);
          });
          iconExpression.push(''); // Fallback to empty string

          iconImageLayout = buildAtlasIconLayout(iconExpression);
        } else {
          // Fallback to circle if no icons available
          iconImageLayout = buildAtlasCirclePaint();
        }

        // Add point layer with icons or circles
        mapboxMap.addLayer({
          id: pointLayerId,
          type: tablesWithIcons.length > 0 ? 'symbol' : 'circle',
          source: sourceId,
          ...(tablesWithIcons.length > 0 ? { layout: iconImageLayout } : { paint: iconImageLayout }),
        });

        // Build text-color expression based on table_name
        const textColorExpression = buildAtlasTextColorExpression(uniqueTables);

        // Add label layer
        mapboxMap.addLayer({
          id: pointLabelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: buildAtlasLabelLayout(),
          paint: {
            'text-color': textColorExpression,
          },
        });

        isAddingLayersRef.current = false;

        // Add click handler
        if (!clickHandlersAddedRef.current) {
          mapboxMap.on('click', pointLayerId, (e: any) => {
            const feature = e.features?.[0];
            if (feature && onEntityClick) {
              const props = feature.properties;
              onEntityClick({
                  id: props.id,
                  name: props.name,
                  table_name: props.table_name,
                  lat: e.lngLat.lat,
                  lng: e.lngLat.lng,
              });
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

    // Re-add layers when map style changes (e.g., switching to satellite)
    const handleStyleLoad = () => {
      if (!mounted) return;
      
      const mapboxMap = map as any;
      if (!mapboxMap.isStyleLoaded()) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasEntitiesLayer] Style not loaded yet, waiting...');
        }
        return;
      }
      
      // Prevent concurrent re-initialization
      if (isAddingLayersRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasEntitiesLayer] Already adding layers, skipping');
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[AtlasEntitiesLayer] Style changed, reloading entities...');
      }
      
      // Reset flags and reload entities
      isAddingLayersRef.current = false;
      clickHandlersAddedRef.current = false;
      iconsLoadedRef.current.clear(); // Clear loaded icons so they reload
      
      loadEntities();
    };

    try {
      map.on('style.load', handleStyleLoad);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AtlasEntitiesLayer] Error subscribing to style.load:', e);
      }
    }

    return () => {
      mounted = false;
      try {
        map.off('style.load', handleStyleLoad);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [map, mapLoaded, visibleTables, onEntityClick]);

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
