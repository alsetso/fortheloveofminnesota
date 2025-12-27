'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface AtlasLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  visible?: boolean;
}

interface AtlasEntity {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  table_name: string;
}

// Icon mapping: table_name -> image path
const ICON_MAP: Record<string, string> = {
  cities: '/city.png',
  lakes: '/lakes.png',
  parks: '/park_like.png',
  schools: '/education.png',
  neighborhoods: '/neighborhood.png',
  churches: '/churches.png',
  hospitals: '/hospital.png',
  golf_courses: '/golf courses.png',
  municipals: '/municiples.png',
};

// Icon image IDs for Mapbox
const ICON_IMAGE_IDS: Record<string, string> = {
  cities: 'atlas-icon-city',
  lakes: 'atlas-icon-lakes',
  parks: 'atlas-icon-park',
  schools: 'atlas-icon-education',
  neighborhoods: 'atlas-icon-neighborhood',
  churches: 'atlas-icon-churches',
  hospitals: 'atlas-icon-hospitals',
  golf_courses: 'atlas-icon-golf-courses',
  municipals: 'atlas-icon-municipals',
};

/**
 * AtlasLayer component manages Mapbox atlas entity visualization
 * Displays cities, lakes, parks, schools, and neighborhoods with custom icon images
 * Formatted similar to MentionsLayer
 */
export default function AtlasLayer({ map, mapLoaded, visible = true }: AtlasLayerProps) {
  const sourceId = 'atlas-layer';
  const pointLayerId = 'atlas-layer-point';
  const pointLabelLayerId = 'atlas-layer-label';
  
  const entitiesRef = useRef<AtlasEntity[]>([]);
  const isAddingLayersRef = useRef<boolean>(false);
  const clickHandlersAddedRef = useRef<boolean>(false);
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);
  const iconsLoadedRef = useRef<boolean>(false);

  // Fetch atlas entities and add to map
  useEffect(() => {
    if (!map || !mapLoaded || !visible) {
      // Remove layers if not visible
      if (map) {
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
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[AtlasLayer] Skipping load - map:', !!map, 'mapLoaded:', mapLoaded, 'visible:', visible);
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[AtlasLayer] Starting load - map exists:', !!map, 'mapLoaded:', mapLoaded, 'visible:', visible);
    }

    let mounted = true;

    const loadEntities = async () => {
      if (isAddingLayersRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Already adding layers, skipping...');
        }
        return;
      }
      
      try {
        isAddingLayersRef.current = true;
        const mapboxMap = map as any;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] loadEntities started, mounted:', mounted);
        }

        // Fetch all entities (cities, lakes, parks, schools, neighborhoods) from unified atlas_entities view
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Fetching entities from atlas_entities...');
        }
        
        // Fetch entities - split into separate queries for each type to avoid 1000 row limit
        const [citiesResult, parksResult, schoolsResult, neighborhoodsResult, lakesResult, churchesResult, hospitalsResult, golfCoursesResult, municipalsResult] = await Promise.all([
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'cities').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'parks').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'schools').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'neighborhoods').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'lakes').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'churches').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'hospitals').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'golf_courses').not('lat', 'is', null).not('lng', 'is', null),
          supabase.from('atlas_entities').select('id, name, emoji, lat, lng, table_name').eq('table_name', 'municipals').not('lat', 'is', null).not('lng', 'is', null),
        ]);
        
        // Combine all results
        const entitiesData = [
          ...(citiesResult.data || []),
          ...(parksResult.data || []),
          ...(schoolsResult.data || []),
          ...(neighborhoodsResult.data || []),
          ...(lakesResult.data || []),
          ...(churchesResult.data || []),
          ...(hospitalsResult.data || []),
          ...(golfCoursesResult.data || []),
          ...(municipalsResult.data || []),
        ];
        
        const entitiesError = citiesResult.error || parksResult.error || schoolsResult.error || neighborhoodsResult.error || lakesResult.error || churchesResult.error || hospitalsResult.error || golfCoursesResult.error || municipalsResult.error;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AtlasLayer] Fetched separately - Cities: ${citiesResult.data?.length || 0}, Parks: ${parksResult.data?.length || 0}, Schools: ${schoolsResult.data?.length || 0}, Neighborhoods: ${neighborhoodsResult.data?.length || 0}, Lakes: ${lakesResult.data?.length || 0}, Churches: ${churchesResult.data?.length || 0}, Hospitals: ${hospitalsResult.data?.length || 0}, Golf Courses: ${golfCoursesResult.data?.length || 0}, Municipals: ${municipalsResult.data?.length || 0}`);
        }

        if (entitiesError) {
          console.error('[AtlasLayer] Error fetching entities:', entitiesError);
          isAddingLayersRef.current = false;
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Fetched', entitiesData?.length || 0, 'entities');
          // Count by table_name
          const counts = (entitiesData || []).reduce((acc: Record<string, number>, entity: any) => {
            acc[entity.table_name] = (acc[entity.table_name] || 0) + 1;
            return acc;
          }, {});
          console.log('[AtlasLayer] Entity counts by type:', JSON.stringify(counts, null, 2));
          // Show sample lakes if any
          const lakes = (entitiesData || []).filter((e: any) => e.table_name === 'lakes');
          if (lakes.length > 0) {
            console.log(`[AtlasLayer] Found ${lakes.length} lakes, sample:`, lakes.slice(0, 3));
          } else {
            console.warn('[AtlasLayer] No lakes found in fetched data!');
          }
        }

        if (!mounted) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[AtlasLayer] Component unmounted, stopping');
          }
          isAddingLayersRef.current = false;
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Processing', entitiesData?.length || 0, 'entities...');
        }

        // Map entities to AtlasEntity format
        try {
          const entities: AtlasEntity[] = (entitiesData || []).map((entity: any) => ({
            id: entity.id,
            name: entity.name,
            emoji: entity.emoji || '',
            lat: Number(entity.lat),
            lng: Number(entity.lng),
            table_name: entity.table_name,
          }));

          entitiesRef.current = entities;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[AtlasLayer] Successfully mapped', entities.length, 'entities');
          }
        } catch (mappingError) {
          console.error('[AtlasLayer] Error mapping entities:', mappingError);
          isAddingLayersRef.current = false;
          return;
        }

        // Validate we have data
        if (entitiesRef.current.length === 0) {
          console.warn('[AtlasLayer] No entities found to display');
          isAddingLayersRef.current = false;
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Mapped', entitiesRef.current.length, 'entities to AtlasEntity format');
        }

        // Convert to GeoJSON with validation
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: entitiesRef.current
            .filter((entity) => {
              // Validate coordinates
              const lat = Number(entity.lat);
              const lng = Number(entity.lng);
              return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
            })
            .map((entity) => ({
              type: 'Feature' as const,
              id: entity.id,
              geometry: {
                type: 'Point' as const,
                coordinates: [Number(entity.lng), Number(entity.lat)],
              },
              properties: {
                id: entity.id,
                name: entity.name || '',
                emoji: entity.emoji || '',
                table_name: entity.table_name || '',
              },
            })),
        };

        if (geoJSON.features.length === 0) {
          console.warn('[AtlasLayer] No valid entities after filtering');
          isAddingLayersRef.current = false;
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Loaded entities:', entitiesRef.current.length, 'valid features:', geoJSON.features.length);
          console.log('[AtlasLayer] Map style loaded:', mapboxMap.isStyleLoaded());
          console.log('[AtlasLayer] Sample entities:', entitiesRef.current.slice(0, 3));
        }

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
            console.warn('[AtlasLayer] Error checking existing source:', e);
          }
        }

        // Wait for style to be fully loaded before adding source and layers
        if (!mapboxMap.isStyleLoaded()) {
          console.warn('[AtlasLayer] Map style not loaded, waiting...');
          mapboxMap.once('styledata', () => {
            if (mounted) {
              setTimeout(() => loadEntities(), 100);
            }
          });
          isAddingLayersRef.current = false;
          return;
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

        // Add source (only after style is loaded)
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Adding source with', geoJSON.features.length, 'features...');
        }
        try {
          mapboxMap.addSource(sourceId, {
            type: 'geojson',
            data: geoJSON,
          });
          if (process.env.NODE_ENV === 'development') {
            console.log('[AtlasLayer] Source added successfully');
          }
        } catch (sourceError) {
          console.error('[AtlasLayer] Error adding source:', sourceError);
          isAddingLayersRef.current = false;
          return;
        }

        // Verify source exists before adding layers
        if (!mapboxMap.getSource(sourceId)) {
          console.error('[AtlasLayer] Source does not exist before adding layer');
          isAddingLayersRef.current = false;
          return;
        }

        // Load all icon images if not already loaded
        if (!iconsLoadedRef.current) {
          try {
            for (const [tableName, imagePath] of Object.entries(ICON_MAP)) {
              const imageId = ICON_IMAGE_IDS[tableName];
              
              if (process.env.NODE_ENV === 'development') {
                console.log(`[AtlasLayer] Loading icon for ${tableName}: ${imagePath} (id: ${imageId})`);
              }
              
              // Check if image already exists
              if (!mapboxMap.hasImage(imageId)) {
                // Create an Image element and wait for it to load
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                  img.onload = () => {
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`[AtlasLayer] Icon loaded: ${tableName}`);
                    }
                    resolve(null);
                  };
                  img.onerror = (err) => {
                    console.error(`[AtlasLayer] Failed to load icon for ${tableName}:`, err);
                    reject(err);
                  };
                  img.src = imagePath;
                });
                
                // Create a canvas to resize the image to 64x64 for high quality
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                  // Use high-quality image smoothing
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  
                  // Draw the image scaled to 64x64
                  ctx.drawImage(img, 0, 0, 64, 64);
                  
                  // Get ImageData and add to map with pixelRatio for retina displays
                  const imageData = ctx.getImageData(0, 0, 64, 64);
                  mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`[AtlasLayer] Icon added to map: ${tableName} (${imageId})`);
                  }
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[AtlasLayer] Icon already exists: ${tableName} (${imageId})`);
                }
              }
            }
            iconsLoadedRef.current = true;
            if (process.env.NODE_ENV === 'development') {
              console.log('[AtlasLayer] All icons loaded successfully');
            }
          } catch (error) {
            console.error('[AtlasLayer] Failed to load atlas icons:', error);
            // Continue anyway - icons may show as missing
          }
        }

        // Add points as atlas icons with zoom-based sizing (similar to MentionsLayer)
        // Add before mentions layers so atlas appears underneath
        try {
          const pointLayerOptions: any = {
            id: pointLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'icon-image': [
                'case',
                ['==', ['get', 'table_name'], 'cities'],
                ICON_IMAGE_IDS.cities,
                ['==', ['get', 'table_name'], 'lakes'],
                ICON_IMAGE_IDS.lakes,
                ['==', ['get', 'table_name'], 'parks'],
                ICON_IMAGE_IDS.parks,
                ['==', ['get', 'table_name'], 'schools'],
                ICON_IMAGE_IDS.schools,
                ['==', ['get', 'table_name'], 'neighborhoods'],
                ICON_IMAGE_IDS.neighborhoods,
                ['==', ['get', 'table_name'], 'churches'],
                ICON_IMAGE_IDS.churches,
                ['==', ['get', 'table_name'], 'hospitals'],
                ICON_IMAGE_IDS.hospitals,
                ['==', ['get', 'table_name'], 'golf_courses'],
                ICON_IMAGE_IDS.golf_courses,
                ['==', ['get', 'table_name'], 'municipals'],
                ICON_IMAGE_IDS.municipals,
                'atlas-icon-city', // fallback to city icon
              ],
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 0.15,   // At zoom 0, size is 0.15 (small for overview)
                5, 0.25,   // At zoom 5, size is 0.25
                10, 0.4,   // At zoom 10, size is 0.4
                12, 0.5,   // At zoom 12, size is 0.5
                14, 0.65,  // At zoom 14, size is 0.65
                16, 0.8,   // At zoom 16, size is 0.8
                18, 1.0,   // At zoom 18, size is 1.0 (full size)
                20, 1.2,   // At zoom 20, size is 1.2 (larger when zoomed in)
              ],
              'icon-anchor': 'center',
              'icon-allow-overlap': true,
            },
          };

          // Try to add before mentions point layer if it exists
          if (process.env.NODE_ENV === 'development') {
            console.log('[AtlasLayer] Adding point layer...');
          }
          try {
            if (mapboxMap.getLayer('map-mentions-point')) {
              mapboxMap.addLayer(pointLayerOptions, 'map-mentions-point');
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Point layer added before map-mentions-point');
              }
            } else {
              mapboxMap.addLayer(pointLayerOptions);
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Point layer added');
              }
            }
          } catch (beforeIdError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[AtlasLayer] Error adding with beforeId, trying without:', beforeIdError);
            }
            // Fallback: add without beforeId
            try {
              mapboxMap.addLayer(pointLayerOptions);
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Point layer added (fallback)');
              }
            } catch (fallbackError) {
              console.error('[AtlasLayer] Error adding point layer (fallback):', fallbackError);
              throw fallbackError;
            }
          }
        } catch (e) {
          console.error('[AtlasLayer] Error adding point layer:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Add labels for points (positioned above icon, similar to MentionsLayer)
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Adding label layer...');
        }
        try {
          const labelLayerOptions: any = {
            id: pointLabelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': [
                'case',
                ['==', ['get', 'table_name'], 'cities'],
                '#3b82f6', // blue
                ['==', ['get', 'table_name'], 'neighborhoods'],
                '#f97316', // orange
                ['==', ['get', 'table_name'], 'parks'],
                '#22c55e', // green
                ['==', ['get', 'table_name'], 'schools'],
                '#eab308', // yellow
                ['==', ['get', 'table_name'], 'lakes'],
                '#0ea5e9', // light blue
                ['==', ['get', 'table_name'], 'churches'],
                '#8b5cf6', // purple
                ['==', ['get', 'table_name'], 'hospitals'],
                '#ef4444', // red
                ['==', ['get', 'table_name'], 'golf_courses'],
                '#10b981', // emerald
                ['==', ['get', 'table_name'], 'municipals'],
                '#6366f1', // indigo
                '#000000', // fallback black
              ],
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          };

          // Try to add before mentions label layer if it exists
          try {
            if (mapboxMap.getLayer('map-mentions-point-label')) {
              mapboxMap.addLayer(labelLayerOptions, 'map-mentions-point-label');
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Label layer added before map-mentions-point-label');
              }
            } else {
              mapboxMap.addLayer(labelLayerOptions);
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Label layer added');
              }
            }
          } catch (beforeIdError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[AtlasLayer] Error adding label with beforeId, trying without:', beforeIdError);
            }
            // Fallback: add without beforeId
            try {
              mapboxMap.addLayer(labelLayerOptions);
              if (process.env.NODE_ENV === 'development') {
                console.log('[AtlasLayer] Label layer added (fallback)');
              }
            } catch (fallbackError) {
              console.error('[AtlasLayer] Error adding label layer (fallback):', fallbackError);
              throw fallbackError;
            }
          }
        } catch (e) {
          console.error('[AtlasLayer] Error adding label layer:', e);
          // Try to remove the point layer if label layer failed
          try {
            if (mapboxMap.getLayer(pointLayerId)) {
              mapboxMap.removeLayer(pointLayerId);
            }
          } catch (removeError) {
            // Ignore removal errors
          }
          isAddingLayersRef.current = false;
          return;
        }

        isAddingLayersRef.current = false;
        if (process.env.NODE_ENV === 'development') {
          console.log('[AtlasLayer] Successfully added all layers!');
        }

        // Add click handlers (only once)
        if (!clickHandlersAddedRef.current) {
          const handleAtlasClick = (e: any) => {
            if (!mounted) return;
            
            const features = mapboxMap.queryRenderedFeatures(e.point, {
              layers: [pointLayerId, pointLabelLayerId],
            });

            if (features.length === 0) return;

            const feature = features[0];
            const props = feature.properties;
            
            window.dispatchEvent(new CustomEvent('atlas-entity-click', {
              detail: {
                id: props.id,
                name: props.name,
                table_name: props.table_name,
                emoji: props.emoji,
                lat: e.lngLat.lat,
                lng: e.lngLat.lng,
              },
            }));
          };

          mapboxMap.on('click', pointLayerId, handleAtlasClick);
          mapboxMap.on('click', pointLabelLayerId, handleAtlasClick);

          // Change cursor on hover
          mapboxMap.on('mouseenter', pointLayerId, () => {
            mapboxMap.getCanvas().style.cursor = 'pointer';
          });

          mapboxMap.on('mouseleave', pointLayerId, () => {
            mapboxMap.getCanvas().style.cursor = '';
          });

          mapboxMap.on('mouseenter', pointLabelLayerId, () => {
            mapboxMap.getCanvas().style.cursor = 'pointer';
          });

          mapboxMap.on('mouseleave', pointLabelLayerId, () => {
            mapboxMap.getCanvas().style.cursor = '';
          });

          clickHandlersAddedRef.current = true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load atlas entities';
        console.error('[AtlasLayer] Error loading entities:', errorMessage, error);
        if (process.env.NODE_ENV === 'development') {
          console.error('[AtlasLayer] Full error details:', {
            error,
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
        isAddingLayersRef.current = false;
      }
    };

    loadEntities();

    // Re-add entities when map style changes (e.g., switching to satellite)
    const handleStyleData = () => {
      if (!mounted) return;
      
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
      }
      
      styleChangeTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;
        
        const mapboxMap = map as any;
        if (!mapboxMap.isStyleLoaded()) return;
        
        const sourceExists = !!mapboxMap.getSource(sourceId);
        if (sourceExists) {
          return;
        }
        
        if (isHandlingStyleChangeRef.current) return;
        isHandlingStyleChangeRef.current = true;
        
        isAddingLayersRef.current = false;
        clickHandlersAddedRef.current = false;
        iconsLoadedRef.current = false; // Reload icons after style change
        
        loadEntities().finally(() => {
          isHandlingStyleChangeRef.current = false;
        });
      }, 100);
    };

    // Subscribe to style changes
    try {
      map.on('styledata', handleStyleData);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AtlasLayer] Error subscribing to styledata:', e);
      }
    }

    return () => {
      mounted = false;
      
      if (styleChangeTimeoutRef.current) {
        clearTimeout(styleChangeTimeoutRef.current);
        styleChangeTimeoutRef.current = null;
      }
      
      if (map && typeof map.off === 'function') {
        try {
          map.off('styledata', handleStyleData);
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [map, mapLoaded, visible]);

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
