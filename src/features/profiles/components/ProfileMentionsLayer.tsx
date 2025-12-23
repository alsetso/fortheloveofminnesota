'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { ProfilePin } from '@/types/profile';

interface ProfileMentionsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  pins: ProfilePin[];
}

const SOURCE_ID = 'profile-mentions';
const LAYER_IDS = {
  points: 'profile-mentions-point',
  labels: 'profile-mentions-point-label',
} as const;
const PIN_IMAGE_ID = 'profile-mention-icon';
const PIN_PRIVATE_IMAGE_ID = 'profile-mention-private-icon';

export default function ProfileMentionsLayer({
  map,
  mapLoaded,
  pins,
}: ProfileMentionsLayerProps) {
  const pinsRef = useRef<ProfilePin[]>(pins);
  const initializedRef = useRef(false);

  // Update refs
  pinsRef.current = pins;

  // Convert ProfilePin to GeoJSON
  const pinsToGeoJSON = (pins: ProfilePin[]) => {
    const features = pins.map((pin) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.lng, pin.lat] as [number, number],
      },
      properties: {
        id: pin.id,
        description: pin.description,
        visibility: pin.visibility,
      },
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  };

  // Add pins to map
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const addPinsToMap = () => {
      try {
        const geoJSON = pinsToGeoJSON(pinsRef.current);

        // Check if source already exists
        try {
          const existingSource = map.getSource(SOURCE_ID);
          if (existingSource && existingSource.type === 'geojson') {
            // Update existing source data
            existingSource.setData(geoJSON);
            initializedRef.current = true;
            return;
          }
        } catch (e) {
          // Source doesn't exist, continue
        }

        // Add pin images
        if (!map.hasImage(PIN_IMAGE_ID)) {
          const imageSize = 32;
          const canvas = document.createElement('canvas');
          canvas.width = imageSize;
          canvas.height = imageSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            // Red circle for public mentions
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(imageSize / 2, imageSize / 2, imageSize / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            // White border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          const imageData = ctx?.getImageData(0, 0, imageSize, imageSize);
          if (imageData) {
            map.addImage(PIN_IMAGE_ID, imageData, { pixelRatio: 2 });
          }
        }

        if (!map.hasImage(PIN_PRIVATE_IMAGE_ID)) {
          const imageSize = 32;
          const canvas = document.createElement('canvas');
          canvas.width = imageSize;
          canvas.height = imageSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            // Gray circle for private mentions
            ctx.fillStyle = '#9ca3af';
            ctx.beginPath();
            ctx.arc(imageSize / 2, imageSize / 2, imageSize / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
            // White border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          const imageData = ctx?.getImageData(0, 0, imageSize, imageSize);
          if (imageData) {
            map.addImage(PIN_PRIVATE_IMAGE_ID, imageData, { pixelRatio: 2 });
          }
        }

        // Add source
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJSON,
        });

        // Add point layer
        map.addLayer({
          id: LAYER_IDS.points,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': [
              'case',
              ['==', ['get', 'visibility'], 'only_me'],
              PIN_PRIVATE_IMAGE_ID,
              PIN_IMAGE_ID,
            ],
            'icon-size': 0.8,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });

        // Add label layer
        map.addLayer({
          id: LAYER_IDS.labels,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'description'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-optional': true,
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });

        initializedRef.current = true;
      } catch (error) {
        console.error('[ProfileMentionsLayer] Error adding pins:', error);
      }
    };

    addPinsToMap();
  }, [map, mapLoaded]);

  // Update pins when they change
  useEffect(() => {
    if (!map || !mapLoaded || !initializedRef.current) return;

    try {
      const geoJSON = pinsToGeoJSON(pinsRef.current);
      const source = map.getSource(SOURCE_ID);
      if (source && source.type === 'geojson') {
        source.setData(geoJSON);
      }
    } catch (error) {
      console.error('[ProfileMentionsLayer] Error updating pins:', error);
    }
  }, [map, mapLoaded, pins]);

  return null;
}
