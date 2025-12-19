'use client';

import { useRef, useEffect, useState } from 'react';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';

interface CountyMapProps {
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  countyName: string;
  height?: string;
  className?: string;
}

export default function CountyMap({
  polygon,
  countyName,
  height = '300px',
  className = '',
}: CountyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !polygon || map.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      try {
        await import('mapbox-gl/dist/mapbox-gl.css');

        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) return;

        // Calculate bounds from polygon
        let minLng = Infinity;
        let maxLng = -Infinity;
        let minLat = Infinity;
        let maxLat = -Infinity;

        const processCoordinates = (coords: number[][]) => {
          coords.forEach(([lng, lat]) => {
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          });
        };

        if (polygon.type === 'Polygon') {
          polygon.coordinates.forEach(ring => processCoordinates(ring));
        } else if (polygon.type === 'MultiPolygon') {
          polygon.coordinates.forEach(p => {
            p.forEach(ring => processCoordinates(ring));
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
          // Add polygon source and layer
          const sourceId = 'county-polygon-source';
          const layerId = 'county-polygon-layer';
          const outlineLayerId = 'county-polygon-outline';

          mapInstance.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: polygon,
              properties: { name: countyName },
            },
          });

          // Add fill layer
          mapInstance.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#3b82f6',
              'fill-opacity': 0.2,
            },
          });

          // Add outline layer
          mapInstance.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#3b82f6',
              'line-width': 2,
            },
          });

          // Fit bounds to polygon
          const bounds = new mapbox.LngLatBounds();
          if (polygon.type === 'Polygon') {
            polygon.coordinates[0].forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          } else if (polygon.type === 'MultiPolygon') {
            polygon.coordinates[0][0].forEach(([lng, lat]) => {
              bounds.extend([lng, lat]);
            });
          }

          mapInstance.fitBounds(bounds, {
            padding: 40,
            duration: 1000,
          });

          setMapLoaded(true);
        });

        map.current = mapInstance;

        return () => {
          if (map.current && !map.current.removed) {
            map.current.remove();
            map.current = null;
          }
        };
      } catch (error) {
        console.error('Error initializing county map:', error);
      }
    };

    initMap();
  }, [polygon, countyName]);

  if (!polygon) {
    return null;
  }

  return (
    <div className={`rounded-md border border-gray-200 overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}






