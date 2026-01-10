'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';
import {
  buildAtlasIconLayout,
  buildAtlasIconPaint,
  buildAtlasCirclePaint,
  buildAtlasLabelLayout,
  buildAtlasLabelPaint,
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
    console.log('[AtlasEntitiesLayer] Effect triggered:', {
      hasMap: !!map,
      mapLoaded,
      visibleTablesCount: visibleTables.length,
      visibleTables,
    });

    if (!map || !mapLoaded || visibleTables.length === 0) {
      // Remove layers if no tables are visible
      console.log('[AtlasEntitiesLayer] Removing layers - no visible tables or map not ready');
      const mapboxMap = map as any;
      try {
        if (mapboxMap?.getLayer(pointLabelLayerId)) {
          console.log('[AtlasEntitiesLayer] Removing label layer');
          mapboxMap.removeLayer(pointLabelLayerId);
        }
        if (mapboxMap?.getLayer(pointLayerId)) {
          console.log('[AtlasEntitiesLayer] Removing point layer');
          mapboxMap.removeLayer(pointLayerId);
        }
        if (mapboxMap?.getSource(sourceId)) {
          console.log('[AtlasEntitiesLayer] Removing source');
          mapboxMap.removeSource(sourceId);
        }
        console.log('[AtlasEntitiesLayer] Layers removed successfully');
      } catch (e) {
        console.error('[AtlasEntitiesLayer] Error removing layers:', e);
      }
      return;
    }

    let mounted = true;

    const loadEntities = async () => {
      if (isAddingLayersRef.current) {
        console.log('[AtlasEntitiesLayer] Already adding layers, skipping');
        return;
      }
      
      console.log('[AtlasEntitiesLayer] Starting to load entities for tables:', visibleTables);
      
      try {
        // Fetch icon paths from atlas_types
        console.log('[AtlasEntitiesLayer] Fetching icon paths for tables:', visibleTables);
        const { data: typesData, error: typesError } = await (supabase as any)
          .schema('atlas')
          .from('atlas_types')
          .select('slug, icon_path')
          .in('slug', visibleTables)
          .not('icon_path', 'is', null);

        if (typesError) {
          console.error('[AtlasEntitiesLayer] Error fetching icon paths:', {
            error: typesError,
            visibleTables,
          });
        } else if (typesData) {
          console.log('[AtlasEntitiesLayer] Icon paths response:', {
            count: typesData.length,
            data: typesData,
          });
          typesData.forEach((type: { slug: string; icon_path: string }) => {
            iconPathsRef.current[type.slug] = type.icon_path;
          });
          console.log('[AtlasEntitiesLayer] Loaded icon paths:', {
            paths: Object.keys(iconPathsRef.current),
            fullPaths: iconPathsRef.current,
          });
        } else {
          console.warn('[AtlasEntitiesLayer] No icon paths data returned');
        }

        // Fetch from individual atlas tables for each visible table type
        // Each table (parks, lakes, schools, etc.) is in the atlas schema
        console.log('[AtlasEntitiesLayer] Fetching entities from individual atlas tables for:', visibleTables);
        let allEntities: AtlasEntity[] = [];
        
        // Fetch from each table type separately
        for (const tableName of visibleTables) {
          console.log(`[AtlasEntitiesLayer] Fetching from atlas.${tableName}...`);
          
          let page = 0;
          const pageSize = 1000;
          let hasMore = true;
          let tableEntities: any[] = [];

          while (hasMore) {
            console.log(`[AtlasEntitiesLayer] Fetching ${tableName} page ${page + 1} (range: ${page * pageSize} to ${(page + 1) * pageSize - 1})`);
            
            try {
              // Fetch from the specific atlas table (e.g., atlas.parks, atlas.lakes)
              const { data, error } = await (supabase as any)
                .schema('atlas')
                .from(tableName)
                .select('id, name, city_id, lat, lng')
                .not('lat', 'is', null)
                .not('lng', 'is', null)
                .range(page * pageSize, (page + 1) * pageSize - 1);

              if (error) {
                console.error(`[AtlasEntitiesLayer] Error fetching from atlas.${tableName}:`, {
                  error,
                  page,
                });
                hasMore = false;
                break;
              }

              if (!data || data.length === 0) {
                console.log(`[AtlasEntitiesLayer] No more ${tableName} entities on page ${page + 1}`);
                hasMore = false;
              } else {
                console.log(`[AtlasEntitiesLayer] Fetched ${data.length} ${tableName} entities on page ${page + 1}`);
                
                // Map to common format and add table_name
                const mappedEntities = data.map((entity: any) => ({
                  ...entity,
                  table_name: tableName,
                  emoji: ENTITY_ICONS[tableName] || '📍', // Add emoji from mapping
                }));
                
                tableEntities = [...tableEntities, ...mappedEntities];
                // If we got fewer than pageSize, we've reached the end
                hasMore = data.length === pageSize;
                page++;
              }
            } catch (error) {
              console.error(`[AtlasEntitiesLayer] Exception fetching from atlas.${tableName}:`, {
                error,
                tableName,
                page,
              });
              hasMore = false;
              break;
            }
          }

          console.log(`[AtlasEntitiesLayer] Total ${tableName} entities fetched:`, tableEntities.length);
          allEntities = [...allEntities, ...tableEntities];
        }

        if (!mounted) {
          console.log('[AtlasEntitiesLayer] Component unmounted, aborting');
          return;
        }

        entitiesRef.current = allEntities;
        console.log('[AtlasEntitiesLayer] Total entities loaded:', {
          total: allEntities.length,
          byTable: allEntities.reduce((acc: Record<string, number>, entity: AtlasEntity) => {
            acc[entity.table_name] = (acc[entity.table_name] || 0) + 1;
            return acc;
          }, {}),
        });
        
        // Debug logging for lakes
        if (process.env.NODE_ENV === 'development') {
          const lakesEntities = entitiesRef.current.filter(e => e.table_name === 'lakes');
          console.log('[AtlasEntitiesLayer] Total entities loaded:', entitiesRef.current.length);
          console.log('[AtlasEntitiesLayer] Lakes entities:', lakesEntities.length);
          if (visibleTables.includes('lakes') && lakesEntities.length === 0) {
            console.warn('[AtlasEntitiesLayer] Lakes is in visibleTables but no lakes entities found');
          }
        }

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
        console.log('[AtlasEntitiesLayer] Loading icons for tables:', uniqueTables);
        
        const iconLoadPromises = uniqueTables.map(async (tableName) => {
          const iconPath = iconPathsRef.current[tableName];
          if (!iconPath) {
            console.warn(`[AtlasEntitiesLayer] No icon path for table: ${tableName}`);
            return;
          }

          const imageId = `atlas-icon-${tableName}`;
          console.log(`[AtlasEntitiesLayer] Loading icon for ${tableName}:`, {
            imageId,
            iconPath,
          });
          
          // Remove existing image if it exists (allows icon updates from admin)
          // This ensures we always load the latest icon_path from atlas_types
          if (mapboxMap.hasImage(imageId)) {
            console.log(`[AtlasEntitiesLayer] Removing existing image: ${imageId}`);
            mapboxMap.removeImage(imageId);
          }
          
          // Clear from loaded set to force reload
          iconsLoadedRef.current.delete(tableName);

          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              img.onload = () => {
                console.log(`[AtlasEntitiesLayer] Icon image loaded: ${tableName}`);
                resolve(undefined);
              };
              img.onerror = (error) => {
                console.error(`[AtlasEntitiesLayer] Icon image failed to load: ${tableName}`, error);
                reject(error);
              };
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
              console.log(`[AtlasEntitiesLayer] Icon added to map: ${imageId} for ${tableName}`);
            } else {
              console.error(`[AtlasEntitiesLayer] Failed to get canvas context for ${tableName}`);
            }
          } catch (error) {
            console.error(`[AtlasEntitiesLayer] Failed to load icon for ${tableName}:`, {
              error,
              iconPath,
              imageId,
            });
          }
        });

        await Promise.all(iconLoadPromises);
        console.log('[AtlasEntitiesLayer] All icons loaded:', {
          loaded: Array.from(iconsLoadedRef.current),
          total: iconsLoadedRef.current.size,
        });

        // Add source
        console.log('[AtlasEntitiesLayer] Adding GeoJSON source:', {
          sourceId,
          featureCount: geoJSON.features.length,
        });
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });
        console.log('[AtlasEntitiesLayer] Source added successfully');

        // Build icon-image expression based on available icons
        const tablesWithIcons = uniqueTables.filter(
          (tableName) => iconPathsRef.current[tableName] && iconsLoadedRef.current.has(tableName)
        );

        if (tablesWithIcons.length > 0) {
          // Build case expression for icon selection
          const iconExpression: any[] = ['case'];
          tablesWithIcons.forEach((tableName) => {
            iconExpression.push(['==', ['get', 'table_name'], tableName]);
            iconExpression.push(`atlas-icon-${tableName}`);
          });
          // Use a default marker icon as fallback instead of empty string
          // If no default exists, Mapbox will show nothing, but at least the expression is valid
          iconExpression.push(''); // Fallback - will be invisible if no icon

          const iconLayout = buildAtlasIconLayout(iconExpression);
          const iconPaint = buildAtlasIconPaint();
          
          // Add point layer with icons
          console.log('[AtlasEntitiesLayer] Adding symbol layer with icons:', {
            pointLayerId,
            tablesWithIcons,
            iconExpression,
            entityCount: entitiesRef.current.length,
          });
          try {
            mapboxMap.addLayer({
              id: pointLayerId,
              type: 'symbol',
              source: sourceId,
              layout: iconLayout,
              paint: iconPaint,
            });
            console.log('[AtlasEntitiesLayer] Symbol layer added successfully');
          } catch (e) {
            console.error('[AtlasEntitiesLayer] Error adding symbol layer:', {
              error: e,
              pointLayerId,
              sourceId,
              tablesWithIcons,
            });
            // Fallback to circle layer if symbol layer fails
            console.log('[AtlasEntitiesLayer] Falling back to circle layer');
            const circlePaint = buildAtlasCirclePaint();
            mapboxMap.addLayer({
              id: pointLayerId,
              type: 'circle',
              source: sourceId,
              paint: circlePaint,
            });
            console.log('[AtlasEntitiesLayer] Circle layer added as fallback');
          }
        } else {
          // Fallback to circle if no icons available
          console.log('[AtlasEntitiesLayer] No icons available, using circle layer fallback');
          const circlePaint = buildAtlasCirclePaint();
          try {
            mapboxMap.addLayer({
              id: pointLayerId,
              type: 'circle',
              source: sourceId,
              paint: circlePaint,
            });
            console.log('[AtlasEntitiesLayer] Circle layer added successfully');
          } catch (e) {
            console.error('[AtlasEntitiesLayer] Error adding circle layer:', {
              error: e,
              pointLayerId,
              sourceId,
            });
          }
        }

        // Add label layer with zoom-based visibility
        console.log('[AtlasEntitiesLayer] Adding label layer:', {
          pointLabelLayerId,
          sourceId,
        });
        try {
          const labelLayout = buildAtlasLabelLayout();
          const labelPaint = buildAtlasLabelPaint();
          
          mapboxMap.addLayer({
            id: pointLabelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: labelLayout,
            paint: {
              'text-color': labelPaint['text-color'],
              'text-opacity': labelPaint['text-opacity'],
              'text-halo-color': labelPaint['text-halo-color'],
              'text-halo-width': labelPaint['text-halo-width'],
              'text-halo-blur': labelPaint['text-halo-blur'],
            },
          });
          console.log('[AtlasEntitiesLayer] Label layer added successfully');
        } catch (e) {
          console.error('[AtlasEntitiesLayer] Error adding label layer:', {
            error: e,
            pointLabelLayerId,
            sourceId,
          });
        }

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
            const canvas = mapboxMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = 'pointer';
            }
          });

          mapboxMap.on('mouseleave', pointLayerId, () => {
            const canvas = mapboxMap.getCanvas();
            if (canvas) {
              canvas.style.cursor = '';
            }
          });

          clickHandlersAddedRef.current = true;
          console.log('[AtlasEntitiesLayer] Click handlers added');
        }
        
        console.log('[AtlasEntitiesLayer] All layers added successfully:', {
          pointLayerId,
          pointLabelLayerId,
          sourceId,
          entityCount: entitiesRef.current.length,
          visibleTables,
        });
        isAddingLayersRef.current = false;
      } catch (error) {
        console.error('[AtlasEntitiesLayer] Error loading entities:', {
          error,
          visibleTables,
          entityCount: entitiesRef.current.length,
        });
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
