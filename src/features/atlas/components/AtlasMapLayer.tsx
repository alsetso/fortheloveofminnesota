'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

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

export interface AtlasEntity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city_name?: string | null;
}

interface AtlasMapLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  tableName: string;
  entities: AtlasEntity[];
  iconPath?: string | null;
  sourceId?: string;
  pointLayerId?: string;
  labelLayerId?: string;
  onEntityClick?: (entity: AtlasEntity) => void;
}

export default function AtlasMapLayer({
  map,
  mapLoaded,
  tableName,
  entities,
  iconPath,
  sourceId = 'atlas-entities',
  pointLayerId = 'atlas-entities-points',
  labelLayerId = 'atlas-entities-labels',
  onEntityClick,
}: AtlasMapLayerProps) {
  const [iconsLoaded, setIconsLoaded] = useState<boolean>(false);
  const clickHandlerAddedRef = useRef<boolean>(false);

  // Load icon image
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    if (mapboxMap.removed) return;

    // Use icon_path from database if provided, otherwise fallback to hardcoded map
    const iconPathToUse = iconPath || ICON_MAP[tableName] || '/city.png';
    const imageId = ICON_IMAGE_IDS[tableName] || ICON_IMAGE_IDS.cities;

    // Check if image already exists for this table
    if (mapboxMap.hasImage(imageId)) {
      setIconsLoaded(true);
      return;
    }

    // Reset loading state when table changes
    setIconsLoaded(false);

    const loadIcon = async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = iconPathToUse;
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
          setIconsLoaded(true);
        }
      } catch (error) {
        console.error('[AtlasMapLayer] Failed to load icon:', error, 'Path:', iconPathToUse);
        // Still set iconsLoaded to true so layers can render with fallback
        setIconsLoaded(true);
      }
    };

    loadIcon();
  }, [map, mapLoaded, tableName, iconPath]);

  // Add/update entities on map
  useEffect(() => {
    if (!map || !mapLoaded || !iconsLoaded) return;

    const mapboxMap = map as any;
    if (mapboxMap.removed) return;

    const imageId = ICON_IMAGE_IDS[tableName] || ICON_IMAGE_IDS.cities;
    
    // Verify image exists - if not, we'll use a fallback circle
    const hasImage = mapboxMap.hasImage(imageId);

    // Filter entities with valid coordinates
    const validEntities = entities.filter(
      e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng)
    );

    if (validEntities.length === 0) {
      // Remove layers and source if no entities
      try {
        if (mapboxMap.getLayer(labelLayerId)) {
          mapboxMap.removeLayer(labelLayerId);
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

    // Create GeoJSON
    const geoJsonData = {
      type: 'FeatureCollection' as const,
      features: validEntities.map((entity) => ({
        type: 'Feature' as const,
        id: entity.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [entity.lng, entity.lat] as [number, number],
        },
        properties: {
          id: entity.id,
          name: entity.name || '',
          table_name: tableName,
        },
      })),
    };

    try {
      // Check if source exists
      const existingSource = mapboxMap.getSource(sourceId);
      if (existingSource) {
        // Update existing source
        (existingSource as any).setData(geoJsonData);
        
        // Check if layers exist, if not re-add them
        if (!mapboxMap.getLayer(pointLayerId)) {
          if (hasImage) {
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
          } else {
            mapboxMap.addLayer({
              id: pointLayerId,
              type: 'circle',
              source: sourceId,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 3,
                  10, 5,
                  15, 8,
                  20, 12,
                ],
                'circle-color': '#3b82f6',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            });
          }
        }
        
        if (!mapboxMap.getLayer(labelLayerId)) {
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
              'text-color': '#ffffff',
              'text-halo-color': '#4b5563',
              'text-halo-width': 2,
              'text-halo-blur': 1,
            },
          });
        }
        
        return;
      }

      // Add source
      mapboxMap.addSource(sourceId, {
        type: 'geojson',
        data: geoJsonData,
      });

      // Add point layer - use icon if available, otherwise use circle
      if (hasImage) {
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
      } else {
        // Fallback to circle if icon not available
        mapboxMap.addLayer({
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 3,
              10, 5,
              15, 8,
              20, 12,
            ],
            'circle-color': '#3b82f6',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

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
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-halo-blur': 0,
        },
      });
    } catch (err) {
      console.error('[AtlasMapLayer] Error adding layers:', err);
    }
  }, [map, mapLoaded, entities, tableName, sourceId, pointLayerId, labelLayerId, iconsLoaded]);

  // Add click handler for entities
  useEffect(() => {
    if (!map || !mapLoaded || !onEntityClick || clickHandlerAddedRef.current) return;

    const mapboxMap = map as any;
    if (mapboxMap.removed) return;

    const handleClick = (e: any) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [pointLayerId],
      });

      if (features.length > 0) {
        const feature = features[0];
        const entity = entities.find(e => e.id === feature.properties?.id);
        if (entity) {
          onEntityClick(entity);
        }
      }
    };

    mapboxMap.on('click', pointLayerId, handleClick);
    const canvas = mapboxMap.getCanvas();
    if (canvas) {
      canvas.style.cursor = 'pointer';
    }

    clickHandlerAddedRef.current = true;

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', pointLayerId, handleClick);
        const cleanupCanvas = mapboxMap.getCanvas();
        if (cleanupCanvas) {
          cleanupCanvas.style.cursor = '';
        }
      }
      clickHandlerAddedRef.current = false;
    };
  }, [map, mapLoaded, entities, pointLayerId, onEntityClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        const mapboxMap = map as any;
        try {
          if (mapboxMap.getLayer(labelLayerId)) {
            mapboxMap.removeLayer(labelLayerId);
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
    };
  }, [map, sourceId, pointLayerId, labelLayerId]);

  return null;
}

