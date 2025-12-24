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
};

// Icon image IDs for Mapbox
const ICON_IMAGE_IDS: Record<string, string> = {
  cities: 'atlas-icon-city',
  lakes: 'atlas-icon-lakes',
  parks: 'atlas-icon-park',
  schools: 'atlas-icon-education',
  neighborhoods: 'atlas-icon-neighborhood',
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
      return;
    }

    let mounted = true;

    const loadEntities = async () => {
      if (isAddingLayersRef.current) return;
      
      try {
        isAddingLayersRef.current = true;
        const mapboxMap = map as any;

        // Fetch all entities (cities, lakes, parks, schools, neighborhoods) from unified atlas_entities view
        const { data: entitiesData, error: entitiesError } = await supabase
          .from('atlas_entities')
          .select('id, name, emoji, lat, lng, table_name')
          .in('table_name', ['cities', 'lakes', 'parks', 'schools', 'neighborhoods'])
          .not('lat', 'is', null)
          .not('lng', 'is', null);

        if (entitiesError) {
          console.error('[AtlasLayer] Error fetching entities:', entitiesError);
        }

        if (!mounted) return;

        // Map entities to AtlasEntity format
        const entities: AtlasEntity[] = (entitiesData || []).map((entity: any) => ({
          id: entity.id,
          name: entity.name,
          emoji: entity.emoji || '',
          lat: Number(entity.lat),
          lng: Number(entity.lng),
          table_name: entity.table_name,
        }));

        entitiesRef.current = entities;

        // Validate we have data
        if (entitiesRef.current.length === 0) {
          console.warn('[AtlasLayer] No entities found to display');
          isAddingLayersRef.current = false;
          return;
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
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });

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
              
              // Check if image already exists
              if (!mapboxMap.hasImage(imageId)) {
                // Create an Image element and wait for it to load
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
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
                }
              }
            }
            iconsLoadedRef.current = true;
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
                '', // fallback
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
          try {
            if (mapboxMap.getLayer('map-mentions-point')) {
              mapboxMap.addLayer(pointLayerOptions, 'map-mentions-point');
            } else {
              mapboxMap.addLayer(pointLayerOptions);
            }
          } catch (beforeIdError) {
            // Fallback: add without beforeId
            mapboxMap.addLayer(pointLayerOptions);
          }
        } catch (e) {
          console.error('[AtlasLayer] Error adding point layer:', e);
          isAddingLayersRef.current = false;
          return;
        }

        // Add labels for points (positioned above icon, similar to MentionsLayer)
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
            } else {
              mapboxMap.addLayer(labelLayerOptions);
            }
          } catch (beforeIdError) {
            // Fallback: add without beforeId
            mapboxMap.addLayer(labelLayerOptions);
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
