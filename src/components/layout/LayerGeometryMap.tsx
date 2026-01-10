'use client';

import { useRef, useEffect, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface LayerGeometryMapProps {
  geometry: GeoJSON.Geometry;
  height?: string;
  className?: string;
  fillColor?: string;
  outlineColor?: string;
}

export default function LayerGeometryMap({
  geometry,
  height = '300px',
  className = '',
  fillColor = '#3b82f6',
  outlineColor = '#3b82f6',
}: LayerGeometryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !geometry || map.current) return;

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

        // Calculate bounds from geometry
        let minLng = Infinity;
        let maxLng = -Infinity;
        let minLat = Infinity;
        let maxLat = -Infinity;

        const processCoordinates = (coords: number[] | number[][] | number[][][]) => {
          if (typeof coords[0] === 'number') {
            // Point
            const [lng, lat] = coords as number[];
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          } else if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            // LineString or Polygon ring
            (coords as number[][]).forEach(([lng, lat]) => {
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
            });
          } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
            // MultiLineString or MultiPolygon
            (coords as number[][][]).forEach(ring => {
              ring.forEach(([lng, lat]) => {
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
              });
            });
          }
        };

        // Process geometry based on type
        if (geometry.type === 'Point') {
          processCoordinates(geometry.coordinates as number[]);
        } else if (geometry.type === 'LineString') {
          processCoordinates(geometry.coordinates as number[][]);
        } else if (geometry.type === 'Polygon') {
          (geometry.coordinates as number[][][]).forEach(ring => processCoordinates(ring));
        } else if (geometry.type === 'MultiPoint') {
          (geometry.coordinates as number[][]).forEach(point => processCoordinates(point));
        } else if (geometry.type === 'MultiLineString') {
          (geometry.coordinates as number[][][]).forEach(line => processCoordinates(line));
        } else if (geometry.type === 'MultiPolygon') {
          (geometry.coordinates as number[][][][]).forEach(poly => {
            poly.forEach(ring => processCoordinates(ring));
          });
        }

        const center: [number, number] = [
          (minLng + maxLng) / 2,
          (minLat + maxLat) / 2,
        ];

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center,
          zoom: 9,
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

        mapInstance.on('load', () => {
          const mapboxMap = mapInstance as any;
          const sourceId = 'layer-geometry-source';
          const layerId = 'layer-geometry-layer';
          const outlineLayerId = 'layer-geometry-outline';

          // Create feature from geometry
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry,
            properties: {},
          };

          mapboxMap.addSource(sourceId, {
            type: 'geojson',
            data: feature,
          });

          // Add layers based on geometry type
          if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
            // Add fill layer
            mapboxMap.addLayer({
              id: layerId,
              type: 'fill',
              source: sourceId,
              paint: {
                'fill-color': fillColor,
                'fill-opacity': 0.2,
              },
            });

            // Add outline layer
            mapboxMap.addLayer({
              id: outlineLayerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': outlineColor,
                'line-width': 2,
              },
            });
          } else if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
            // Add line layer
            mapboxMap.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': outlineColor,
                'line-width': 2,
              },
            });
          } else if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
            // Add circle layer for points
            mapboxMap.addLayer({
              id: layerId,
              type: 'circle',
              source: sourceId,
              paint: {
                'circle-color': fillColor,
                'circle-radius': 8,
                'circle-opacity': 0.8,
              },
            });
          }

          // Fit bounds to geometry
          const bounds = new mapbox.LngLatBounds();
          
          if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates as number[];
            bounds.extend([lng, lat]);
          } else if (geometry.type === 'LineString') {
            (geometry.coordinates as number[][]).forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          } else if (geometry.type === 'Polygon') {
            (geometry.coordinates as number[][][])[0].forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          } else if (geometry.type === 'MultiPoint') {
            (geometry.coordinates as number[][]).forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          } else if (geometry.type === 'MultiLineString') {
            (geometry.coordinates as number[][][]).forEach(line => {
              line.forEach(([lng, lat]) => {
                bounds.extend([lng, lat]);
              });
            });
          } else if (geometry.type === 'MultiPolygon') {
            (geometry.coordinates as number[][][][])[0][0].forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          }

          mapInstance.fitBounds(bounds, {
            padding: 40,
            duration: 1000,
          });

          setMapLoaded(true);
          
          // Add 3D building extrusions
          addBuildingExtrusions(mapInstance as MapboxMapInstance);
        });

        map.current = mapInstance;

        return () => {
          if (map.current && !(map.current as any)._removed) {
            map.current.remove();
            map.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing layer geometry map:', error);
        return undefined;
      }
    };

    initMap();
  }, [geometry, fillColor, outlineColor]);

  if (!geometry) {
    return null;
  }

  return (
    <div className={`rounded-md border border-gray-200 overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

