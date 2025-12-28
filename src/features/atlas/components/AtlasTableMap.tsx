'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface AtlasTableMapProps {
  tableName: string;
  records: Record<string, any>[];
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

export default function AtlasTableMap({
  tableName,
  records,
  height = '400px',
  className = '',
}: AtlasTableMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const iconsLoadedRef = useRef<boolean>(false);

  // Filter records with valid coordinates
  const recordsWithCoords = useMemo(() => {
    return records.filter(
      (record) => record.lat && record.lng && !isNaN(parseFloat(record.lat)) && !isNaN(parseFloat(record.lng))
    );
  }, [records]);

  // Update map data when records change
  useEffect(() => {
    if (!map.current || !mapLoaded || recordsWithCoords.length === 0) return;

    const updateMapData = async () => {
      const mapboxMap = map.current as any;
      const sourceId = 'atlas-table-points';

      // Update source data if source exists
      if (mapboxMap.getSource(sourceId)) {
        const geoJsonData = {
          type: 'FeatureCollection' as const,
          features: recordsWithCoords.map((record) => ({
            type: 'Feature' as const,
            id: record.id,
            geometry: {
              type: 'Point' as const,
              coordinates: [parseFloat(record.lng), parseFloat(record.lat)] as [number, number],
            },
            properties: {
              id: record.id,
              name: record.name || '',
              table_name: tableName,
            },
          })),
        };

        const source = mapboxMap.getSource(sourceId) as any;
        if (source && source.setData) {
          source.setData(geoJsonData);
        }

        // Fit bounds to all points if multiple records
        if (recordsWithCoords.length > 1 && map.current) {
          const mapbox = await loadMapboxGL();
          const bounds = new mapbox.LngLatBounds();
          recordsWithCoords.forEach((record) => {
            bounds.extend([parseFloat(record.lng), parseFloat(record.lat)]);
          });
          map.current.fitBounds(bounds, {
            padding: 40,
            duration: 1000,
          });
        }
      }
    };

    updateMapData();
  }, [recordsWithCoords, mapLoaded, tableName]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (recordsWithCoords.length === 0) return;

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

        // Calculate center and bounds from records
        const lngs = recordsWithCoords.map((r) => parseFloat(r.lng));
        const lats = recordsWithCoords.map((r) => parseFloat(r.lat));
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: [centerLng, centerLat],
          zoom: recordsWithCoords.length === 1 ? 15 : 10,
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
          const sourceId = 'atlas-table-points';
          const pointLayerId = 'atlas-table-points-layer';
          const labelLayerId = 'atlas-table-labels-layer';

          // Get icon path and image ID for this table
          const iconPath = ICON_MAP[tableName] || '/city.png';
          const imageId = ICON_IMAGE_IDS[tableName] || ICON_IMAGE_IDS.cities;

          // Load custom icon image
          if (!iconsLoadedRef.current && !mapboxMap.hasImage(imageId)) {
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
              iconsLoadedRef.current = true;
            } catch (error) {
              console.error('[AtlasTableMap] Failed to load icon:', error);
            }
          }

          // Create GeoJSON source with points
          const geoJsonData = {
            type: 'FeatureCollection' as const,
            features: recordsWithCoords.map((record) => ({
              type: 'Feature' as const,
              id: record.id,
              geometry: {
                type: 'Point' as const,
                coordinates: [parseFloat(record.lng), parseFloat(record.lat)] as [number, number],
              },
              properties: {
                id: record.id,
                name: record.name || '',
                table_name: tableName,
              },
            })),
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
              'text-halo-color': '#4b5563',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });

          // Fit bounds to all points if multiple records
          if (recordsWithCoords.length > 1) {
            const bounds = new mapbox.LngLatBounds();
            recordsWithCoords.forEach((record) => {
              bounds.extend([parseFloat(record.lng), parseFloat(record.lat)]);
            });
            mapInstance.fitBounds(bounds, {
              padding: 40,
              duration: 1000,
            });
          }

          setMapLoaded(true);
          
          // Add 3D building extrusions
          addBuildingExtrusions(mapInstance as MapboxMapInstance);
        });

        map.current = mapInstance;

        return () => {
          if (map.current) {
            const mapboxMap = map.current as any;
            try {
              if (mapboxMap.getLayer('atlas-table-labels-layer')) {
                mapboxMap.removeLayer('atlas-table-labels-layer');
              }
              if (mapboxMap.getLayer('atlas-table-points-layer')) {
                mapboxMap.removeLayer('atlas-table-points-layer');
              }
              if (mapboxMap.getSource('atlas-table-points')) {
                mapboxMap.removeSource('atlas-table-points');
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
        console.error('Error initializing atlas table map:', error);
        return undefined;
      }
    };

    initMap();
  }, [tableName, recordsWithCoords]);

  if (recordsWithCoords.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-md border border-gray-200 overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

