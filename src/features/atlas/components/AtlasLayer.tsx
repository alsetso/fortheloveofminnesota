'use client';

import { useEffect } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { supabase } from '@/lib/supabase';

interface AtlasLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  visible?: boolean;
}

/**
 * AtlasLayer - simplified to just display text labels
 */
export default function AtlasLayer({ map, mapLoaded, visible = true }: AtlasLayerProps) {
  const sourceId = 'atlas-layer';
  const iconLayerId = 'atlas-layer-icon';
  const labelLayerId = 'atlas-layer-label';

  useEffect(() => {
    if (!map || !mapLoaded || !visible) {
      const mapboxMap = map as any;
      try {
        if (mapboxMap.getLayer(labelLayerId)) {
          mapboxMap.removeLayer(labelLayerId);
        }
        if (mapboxMap.getLayer(iconLayerId)) {
          mapboxMap.removeLayer(iconLayerId);
        }
        if (mapboxMap.getSource(sourceId)) {
          mapboxMap.removeSource(sourceId);
        }
      } catch (e) {
        // Ignore
      }
      return;
    }

    const mapboxMap = map as any;

    const loadAndDisplay = async () => {
      try {
        // Fetch entities
        const { data, error } = await supabase
          .from('atlas_entities')
          .select('id, name, emoji, lat, lng, table_name')
          .in('table_name', ['cities', 'schools', 'parks'])
          .not('lat', 'is', null)
          .not('lng', 'is', null);

        if (error) {
          console.error('[AtlasLayer] Fetch error:', error);
          return;
        }

        if (!data || data.length === 0) {
          console.warn('[AtlasLayer] No data returned');
          return;
        }

        console.log('[AtlasLayer] Fetched', data.length, 'entities');
        
        // Debug: log first few entities to see emoji values
        if (data.length > 0) {
          console.log('[AtlasLayer] Sample entity:', {
            name: data[0].name,
            emoji: data[0].emoji,
            emojiLength: data[0].emoji?.length,
            emojiCharCode: data[0].emoji?.charCodeAt?.(0),
          });
        }

        // Create GeoJSON
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: data.map((entity: any) => ({
            type: 'Feature' as const,
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

        console.log('[AtlasLayer] Created GeoJSON with', geoJSON.features.length, 'features');
        console.log('[AtlasLayer] Sample feature properties:', geoJSON.features[0]?.properties);

        // Wait for map to be ready
        if (!mapboxMap.isStyleLoaded()) {
          mapboxMap.once('load', () => {
            setTimeout(() => loadAndDisplay(), 100);
          });
          return;
        }

        // Remove existing source/layer
        try {
          if (mapboxMap.getLayer(labelLayerId)) {
            mapboxMap.removeLayer(labelLayerId);
          }
          if (mapboxMap.getLayer(iconLayerId)) {
            mapboxMap.removeLayer(iconLayerId);
          }
          if (mapboxMap.getSource(sourceId)) {
            mapboxMap.removeSource(sourceId);
          }
        } catch (e) {
          // Ignore
        }

        // Add source
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });

        console.log('[AtlasLayer] Added source');

        // Load custom icons for each entity type (same format as MentionsLayer heart icon)
        const iconMap: Record<string, string> = {
          cities: 'atlas-icon-city',
          schools: 'atlas-icon-school',
          parks: 'atlas-icon-park',
        };

        const iconPaths: Record<string, string> = {
          cities: '/city.png',
          schools: '/education.png',
          parks: '/park_like.png',
        };

        // Load all icons
        for (const [type, imageId] of Object.entries(iconMap)) {
          if (!mapboxMap.hasImage(imageId)) {
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = iconPaths[type];
              });
              
              const canvas = document.createElement('canvas');
              canvas.width = 64;
              canvas.height = 64;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, 64, 64);
                const imageData = ctx.getImageData(0, 0, 64, 64);
                mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
              }
            } catch (error) {
              console.error(`[AtlasLayer] Failed to load ${type} icon:`, error);
            }
          }
        }

        // Add icon layer with conditional icon selection based on table_name
        mapboxMap.addLayer({
          id: iconLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': [
              'case',
              ['==', ['get', 'table_name'], 'cities'],
              iconMap.cities,
              ['==', ['get', 'table_name'], 'schools'],
              iconMap.schools,
              ['==', ['get', 'table_name'], 'parks'],
              iconMap.parks,
              iconMap.cities, // default fallback
            ],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.15,
              5, 0.25,
              10, 0.4,
              12, 0.5,
              14, 0.65,
              16, 0.8,
              18, 1.0,
              20, 1.2,
            ],
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
          },
        });

        // Add text layer (positioned above icon, same as MentionsLayer)
        mapboxMap.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['upcase', ['get', 'name']],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': [
              'case',
              ['==', ['get', 'table_name'], 'parks'],
              '#16a34a', // green
              ['==', ['get', 'table_name'], 'schools'],
              '#eab308', // yellow
              ['==', ['get', 'table_name'], 'cities'],
              '#2563eb', // blue
              '#000000', // default black
            ],
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-halo-blur': 1,
          },
        });
        
        // Debug: Check what the layer actually has
        setTimeout(() => {
          try {
            const layer = mapboxMap.getLayer(labelLayerId);
            const source = mapboxMap.getSource(sourceId);
            console.log('[AtlasLayer] Layer added:', {
              layerId: labelLayerId,
              layerExists: !!layer,
              sourceExists: !!source,
              sourceType: source?.type,
              featureCount: source?._data?.features?.length,
            });
          } catch (e) {
            console.error('[AtlasLayer] Error checking layer:', e);
          }
        }, 500);

        console.log('[AtlasLayer] Added text layer');
      } catch (error) {
        console.error('[AtlasLayer] Error:', error);
      }
    };

    loadAndDisplay();
  }, [map, mapLoaded, visible]);

  return null;
}
