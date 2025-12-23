'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { POIService, type PointOfInterest } from '@/features/poi/services/poiService';
import { getPOIEmoji } from '@/features/poi/utils/getPOIEmoji';

interface POIsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible?: boolean;
}

const sourceId = 'pois-active';
const emojiLayerId = 'pois-active-emoji';
const nameLayerId = 'pois-active-name';

/**
 * POIsLayer - Self-contained layer that fetches and displays POIs
 * Shows all active POIs when POI tab is active (?tab=poi)
 */
export default function POIsLayer({ map, mapLoaded, visible = false }: POIsLayerProps) {
  const poisRef = useRef<PointOfInterest[]>([]);
  const isAddingLayersRef = useRef(false);

  // Fetch POIs when visible
  useEffect(() => {
    if (!map || !mapLoaded || !visible) return;

    let mounted = true;

    const loadPOIs = async () => {
      if (isAddingLayersRef.current) return;

      try {
        const pois = await POIService.getPOIs();
        if (!mounted) return;

        poisRef.current = pois;

        const mapboxMap = map as any;

        // Wait for style to load
        if (!mapboxMap.isStyleLoaded()) {
          await new Promise<void>(resolve => {
            const checkStyle = () => {
              if (mapboxMap.isStyleLoaded()) {
                resolve();
              } else {
                requestAnimationFrame(checkStyle);
              }
            };
            checkStyle();
          });
        }

        if (!mounted) return;

        // Convert to GeoJSON using lat/lng directly
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: pois
            .map(poi => {
              // Use lat/lng directly if available, otherwise skip
              if (poi.lat === null || poi.lng === null || poi.lat === undefined || poi.lng === undefined) {
                return null;
              }

              // Get emoji - use stored emoji if available, otherwise calculate from category/type
              const emoji = poi.emoji || getPOIEmoji(poi.category, poi.type);

              if (process.env.NODE_ENV === 'development') {
                console.log(`[POIsLayer] POI ${poi.id}: emoji="${emoji}", category="${poi.category}", type="${poi.type}"`);
              }

              return {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [poi.lng, poi.lat] },
                properties: {
                  id: poi.id,
                  name: poi.name || 'Unnamed POI',
                  emoji,
                  category: poi.category,
                },
              };
            })
            .filter(Boolean),
        };

        if (process.env.NODE_ENV === 'development') {
          console.log(`[POIsLayer] Total POIs: ${pois.length}, Features: ${geoJSON.features.length}`);
          console.log('[POIsLayer] Sample feature:', geoJSON.features[0]);
        }

        isAddingLayersRef.current = true;

        // Create emoji images for each unique emoji
        const uniqueEmojis = new Set<string>();
        geoJSON.features.forEach((feature: any) => {
          if (feature.properties?.emoji) {
            uniqueEmojis.add(feature.properties.emoji);
          }
        });

        // Generate canvas images for each emoji
        const emojiImageMap = new Map<string, string>();
        uniqueEmojis.forEach(emoji => {
          const imageId = `poi-emoji-${emoji}`;
          if (!mapboxMap.hasImage(imageId)) {
            const imageSize = 32;
            const canvas = document.createElement('canvas');
            canvas.width = imageSize;
            canvas.height = imageSize;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              // Clear canvas with transparent background
              ctx.clearRect(0, 0, imageSize, imageSize);
              // Draw emoji - use larger font size for better emoji rendering
              ctx.font = `${imageSize}px Arial, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(emoji, imageSize / 2, imageSize / 2);
            }
            const imageData = ctx?.getImageData(0, 0, imageSize, imageSize);
            if (imageData) {
              mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
            }
          }
          emojiImageMap.set(emoji, imageId);
        });

        // Update GeoJSON properties to include emoji image ID (ensure all features have it)
        geoJSON.features.forEach((feature: any) => {
          if (feature.properties?.emoji && emojiImageMap.has(feature.properties.emoji)) {
            feature.properties.emojiImageId = emojiImageMap.get(feature.properties.emoji);
          } else {
            // Fallback to default emoji if missing
            const defaultEmoji = '📍';
            const defaultImageId = `poi-emoji-${defaultEmoji}`;
            if (!mapboxMap.hasImage(defaultImageId)) {
              const imageSize = 32;
              const canvas = document.createElement('canvas');
              canvas.width = imageSize;
              canvas.height = imageSize;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, imageSize, imageSize);
                ctx.font = `${imageSize * 0.8}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(defaultEmoji, imageSize / 2, imageSize / 2);
              }
              const imageData = ctx?.getImageData(0, 0, imageSize, imageSize);
              if (imageData) {
                mapboxMap.addImage(defaultImageId, imageData, { pixelRatio: 2 });
              }
            }
            feature.properties.emojiImageId = defaultImageId;
          }
        });

        // Update or create source
        const existingSource = mapboxMap.getSource(sourceId);
        if (existingSource) {
          (existingSource as any).setData(geoJSON);
        } else {
          mapboxMap.addSource(sourceId, { type: 'geojson', data: geoJSON });
        }

        // Add emoji icon layer (using canvas-generated images)
        if (!mapboxMap.getLayer(emojiLayerId)) {
          mapboxMap.addLayer({
            id: emojiLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'icon-image': ['get', 'emojiImageId'],
              'icon-size': 0.5,
              'icon-anchor': 'center',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            },
          });
        }

        // Add name label layer (below emoji)
        if (!mapboxMap.getLayer(nameLayerId)) {
          mapboxMap.addLayer({
            id: nameLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-anchor': 'top',
              'text-offset': [0, 1.2],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#111827',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          }, emojiLayerId); // Add after emoji layer
        }

        isAddingLayersRef.current = false;
      } catch (error) {
        console.error('[POIsLayer] Error loading POIs:', error);
        isAddingLayersRef.current = false;
      }
    };

    loadPOIs();

    return () => {
      mounted = false;
    };
  }, [map, mapLoaded, visible]);

  // Cleanup when not visible or component unmounts
  useEffect(() => {
    if (!map || map.removed) return;
    if (visible) return; // Don't cleanup if visible

    const mapboxMap = map as any;

    try {
      if (mapboxMap.getLayer(nameLayerId)) mapboxMap.removeLayer(nameLayerId);
      if (mapboxMap.getLayer(emojiLayerId)) mapboxMap.removeLayer(emojiLayerId);
      if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
    } catch (error) {
      // Ignore cleanup errors
    }
  }, [map, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map || map.removed) return;
      const mapboxMap = map as any;
      
      try {
        if (mapboxMap.getLayer(nameLayerId)) mapboxMap.removeLayer(nameLayerId);
        if (mapboxMap.getLayer(emojiLayerId)) mapboxMap.removeLayer(emojiLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, [map]);

  return null;
}
