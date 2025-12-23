'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useDraftPOIs } from '@/features/poi/contexts/DraftPOIsContext';
import { getPOIEmoji } from '@/features/poi/utils/getPOIEmoji';

interface DraftPOIsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

const sourceId = 'pois-draft';
const emojiLayerId = 'pois-draft-emoji';
const nameLayerId = 'pois-draft-name';

/**
 * DraftPOIsLayer - Displays draft POIs on the map in real-time
 * Shows draft POIs when POI tab is active (?tab=poi)
 */
export default function DraftPOIsLayer({ map, mapLoaded }: DraftPOIsLayerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isPOITabActive = isHomepage && searchParams.get('tab') === 'poi';
  
  const { draftPOIs } = useDraftPOIs();
  const isAddingLayersRef = useRef(false);

  // Update map when draft POIs change
  useEffect(() => {
    if (!map || !mapLoaded || !isPOITabActive) return;

    let mounted = true;

    const updateDraftPOIs = async () => {
      if (isAddingLayersRef.current) return;

      try {
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

        // Convert draft POIs to GeoJSON
        const geoJSON = {
          type: 'FeatureCollection' as const,
          features: draftPOIs
            .map(draft => {
              if (draft.lat === null || draft.lng === null || draft.lat === undefined || draft.lng === undefined) {
                return null;
              }

              // Get emoji - use stored emoji if available, otherwise calculate from category
              const emoji = draft.emoji || getPOIEmoji(draft.category || null, null);

              return {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [draft.lng, draft.lat] },
                properties: {
                  id: draft.id,
                  name: draft.name || 'Unnamed POI',
                  emoji,
                  category: draft.category,
                },
              };
            })
            .filter(Boolean),
        };

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
          const imageId = `draft-poi-emoji-${emoji}`;
          if (!mapboxMap.hasImage(imageId)) {
            const imageSize = 32;
            const canvas = document.createElement('canvas');
            canvas.width = imageSize;
            canvas.height = imageSize;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.clearRect(0, 0, imageSize, imageSize);
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

        // Update GeoJSON properties to include emoji image ID
        geoJSON.features.forEach((feature: any) => {
          if (feature.properties?.emoji && emojiImageMap.has(feature.properties.emoji)) {
            feature.properties.emojiImageId = emojiImageMap.get(feature.properties.emoji);
          } else {
            // Fallback to default emoji if missing
            const defaultEmoji = '📍';
            const defaultImageId = `draft-poi-emoji-${defaultEmoji}`;
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
                ctx.font = `${imageSize}px Arial, sans-serif`;
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
            paint: {
              'icon-opacity': 0.7, // Slightly transparent to distinguish from active POIs
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
              'text-color': '#6b7280', // Gray to distinguish from active POIs
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2,
              'text-halo-blur': 1,
              'text-opacity': 0.7,
            },
          }, emojiLayerId); // Add after emoji layer
        }

        isAddingLayersRef.current = false;
      } catch (error) {
        console.error('[DraftPOIsLayer] Error updating draft POIs:', error);
        isAddingLayersRef.current = false;
      }
    };

    updateDraftPOIs();

    return () => {
      mounted = false;
    };
  }, [map, mapLoaded, isPOITabActive, draftPOIs]);

  // Cleanup when tab is inactive or component unmounts
  useEffect(() => {
    if (!map || map.removed) return;
    if (isPOITabActive) return; // Don't cleanup if tab is active

    const mapboxMap = map as any;

    try {
      if (mapboxMap.getLayer(nameLayerId)) mapboxMap.removeLayer(nameLayerId);
      if (mapboxMap.getLayer(emojiLayerId)) mapboxMap.removeLayer(emojiLayerId);
      if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
    } catch (error) {
      // Ignore cleanup errors
    }
  }, [map, isPOITabActive]);

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

