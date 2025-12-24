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

interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const EMOJI_MAP: Record<string, string> = {
  cities: '🏙️',
  schools: '🎓',
  parks: '🌳',
};

/**
 * AtlasLayer component manages Mapbox atlas entity visualization
 * Displays cities, schools, and parks with emoji icons and labels (name + emoji)
 * Similar to MentionsLayer but for atlas entities
 */
export default function AtlasLayer({ map, mapLoaded, visible = true }: AtlasLayerProps) {
  const sourceId = 'atlas-layer';
  const pointLabelLayerId = 'atlas-layer-label';
  
  const entitiesRef = useRef<AtlasEntity[]>([]);
  const isAddingLayersRef = useRef<boolean>(false);
  const clickHandlersAddedRef = useRef<boolean>(false);
  const styleChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStyleChangeRef = useRef<boolean>(false);

  // Fetch atlas entities and add to map
  useEffect(() => {
    if (!map || !mapLoaded || !visible) {
      // Remove layers if not visible
      const mapboxMap = map as any;
      try {
        if (mapboxMap.getLayer(pointLabelLayerId)) {
          mapboxMap.removeLayer(pointLabelLayerId);
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

        // Fetch cities
        const { data: citiesData, error: citiesError } = await supabase
          .from('cities')
          .select('id, name, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null);

        if (citiesError) {
          console.error('[AtlasLayer] Error fetching cities:', citiesError);
        }

        // Fetch schools and parks from atlas_entities view
        const { data: entitiesData, error: entitiesError } = await supabase
          .from('atlas_entities')
          .select('id, name, emoji, lat, lng, table_name')
          .in('table_name', ['schools', 'parks'])
          .not('lat', 'is', null)
          .not('lng', 'is', null);

        if (entitiesError) {
          console.error('[AtlasLayer] Error fetching entities:', entitiesError);
        }

        if (!mounted) return;

        // Combine cities with emoji
        const cities: AtlasEntity[] = (citiesData || []).map((city: City) => ({
          id: city.id,
          name: city.name,
          emoji: EMOJI_MAP.cities,
          lat: Number(city.lat),
          lng: Number(city.lng),
          table_name: 'cities',
        }));

        // Combine with other entities
        const entities: AtlasEntity[] = (entitiesData || []).map((entity: any) => ({
          id: entity.id,
          name: entity.name,
          emoji: entity.emoji,
          lat: Number(entity.lat),
          lng: Number(entity.lng),
          table_name: entity.table_name,
        }));

        entitiesRef.current = [...cities, ...entities];

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

        // Clean up existing layers
        try {
          if (mapboxMap.getLayer(pointLabelLayerId)) {
            mapboxMap.removeLayer(pointLabelLayerId);
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

        // Wait for style to be fully loaded before adding layers
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

        // Verify source exists before adding layers
        if (!mapboxMap.getSource(sourceId)) {
          console.error('[AtlasLayer] Source does not exist before adding layer');
          isAddingLayersRef.current = false;
          return;
        }

        // Add text layer showing emoji + name
        try {
          const labelOptions: any = {
            id: pointLabelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['concat', ['get', 'emoji'], ' ', ['get', 'name']],
              'text-font': ['Arial Unicode MS Regular', 'DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 10,
                5, 12,
                10, 14,
                12, 16,
                14, 18,
                16, 20,
                18, 22,
                20, 24,
              ],
              'text-anchor': 'center',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          };

          // Try to add before mentions label layer if it exists
          try {
            if (mapboxMap.getLayer('map-mentions-point-label')) {
              mapboxMap.addLayer(labelOptions, 'map-mentions-point-label');
            } else {
              mapboxMap.addLayer(labelOptions);
            }
          } catch (beforeIdError) {
            // Fallback: add without beforeId
            mapboxMap.addLayer(labelOptions);
          }
        } catch (e) {
          console.error('[AtlasLayer] Error adding label layer:', e);
          isAddingLayersRef.current = false;
          return;
        }

        isAddingLayersRef.current = false;

        // Add click handler
        if (!clickHandlersAddedRef.current) {
          mapboxMap.on('click', pointLabelLayerId, (e: any) => {
            const feature = e.features?.[0];
            if (feature) {
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
            }
          });

          // Change cursor on hover
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

