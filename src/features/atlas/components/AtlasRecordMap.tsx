'use client';

import { useRef, useEffect, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface AtlasRecordMapProps {
  lat: number;
  lng: number;
  name: string;
  tableName: string;
  height?: string;
  className?: string;
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

export default function AtlasRecordMap({
  lat,
  lng,
  name,
  tableName,
  height = '300px',
  className = '',
}: AtlasRecordMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!lat || !lng) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      try {
        // @ts-ignore - CSS import
        await import('mapbox-gl/dist/mapbox-gl.css');

        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: [lng, lat],
          zoom: 15,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
          interactive: true,
          scrollZoom: true,
          boxZoom: true,
          dragRotate: false,
          dragPan: true,
          keyboard: true,
          doubleClickZoom: true,
          touchZoomRotate: true,
        });

        mapInstance.on('load', async () => {
          const mapboxMap = mapInstance as any;
          const sourceId = 'atlas-record-point';
          const pointLayerId = 'atlas-record-point-layer';
          const labelLayerId = 'atlas-record-label-layer';

          // Get icon path and image ID for this table
          const iconPath = ICON_MAP[tableName] || '/city.png';
          const imageId = ICON_IMAGE_IDS[tableName] || ICON_IMAGE_IDS.cities;

          // Load custom icon image
          if (!mapboxMap.hasImage(imageId)) {
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = iconPath;
              });

              // Create canvas to resize image to 64x64 for high quality
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
              console.error('[AtlasRecordMap] Failed to load icon:', error);
            }
          }

          // Create GeoJSON source with single point
          const geoJsonData = {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [lng, lat] as [number, number],
                },
                properties: {
                  name,
                  table_name: tableName,
                },
              },
            ],
          };

          // Add source
          mapboxMap.addSource(sourceId, {
            type: 'geojson',
            data: geoJsonData,
          });

          // Add point layer with custom icon
          mapboxMap.addLayer({
            id: pointLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'icon-image': imageId,
              'icon-size': 1.0,
              'icon-anchor': 'center',
              'icon-allow-overlap': true,
            },
          });

          // Add label layer
          mapboxMap.addLayer({
            id: labelLayerId,
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
              'text-color': '#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });

          setMapLoaded(true);
          
          // Add 3D building extrusions
          addBuildingExtrusions(mapInstance as MapboxMapInstance);
        });

        map.current = mapInstance;

        return () => {
          if (map.current) {
            const mapboxMap = map.current as any;
            try {
              if (mapboxMap.getLayer('atlas-record-label-layer')) {
                mapboxMap.removeLayer('atlas-record-label-layer');
              }
              if (mapboxMap.getLayer('atlas-record-point-layer')) {
                mapboxMap.removeLayer('atlas-record-point-layer');
              }
              if (mapboxMap.getSource('atlas-record-point')) {
                mapboxMap.removeSource('atlas-record-point');
              }
            } catch (e) {
              // Ignore cleanup errors
            }
            if (!(map.current as any)._removed) {
              map.current.remove();
              map.current = null;
            }
          }
        };
      } catch (error) {
        console.error('Error initializing atlas record map:', error);
        return undefined;
      }
    };

    initMap();
  }, [lat, lng, name, tableName]);

  if (!lat || !lng) {
    return null;
  }

  return (
    <div className={`rounded-md border border-gray-200 overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

