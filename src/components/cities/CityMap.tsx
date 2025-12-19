'use client';

import { useRef, useEffect, useState } from 'react';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';

interface CityMapProps {
  coordinates?: { lat: number; lng: number } | null;
  boundaryLines?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  cityName: string;
  height?: string;
  className?: string;
}

export default function CityMap({
  coordinates,
  boundaryLines,
  cityName,
  height = '300px',
  className = '',
}: CityMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!boundaryLines && (!coordinates || !coordinates.lat || !coordinates.lng)) return;

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

        let initialCenter: [number, number] = MAP_CONFIG.DEFAULT_CENTER;
        let initialZoom = MAP_CONFIG.DEFAULT_ZOOM;

        // If we have boundary lines, calculate center and bounds from polygon
        if (boundaryLines) {
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

          if (boundaryLines.type === 'Polygon') {
            boundaryLines.coordinates.forEach(ring => processCoordinates(ring));
          } else if (boundaryLines.type === 'MultiPolygon') {
            boundaryLines.coordinates.forEach(p => {
              p.forEach(ring => processCoordinates(ring));
            });
          }

          initialCenter = [
            (minLng + maxLng) / 2,
            (minLat + maxLat) / 2,
          ];
          initialZoom = 11;
        } else if (coordinates) {
          initialCenter = [coordinates.lng, coordinates.lat];
          initialZoom = 13;
        }

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: initialCenter,
          zoom: initialZoom,
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
          // If we have boundary lines, add them to the map
          if (boundaryLines) {
            const sourceId = 'city-boundary-source';
            const layerId = 'city-boundary-layer';
            const outlineLayerId = 'city-boundary-outline';

            mapInstance.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: boundaryLines,
                properties: { name: cityName },
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
            if (boundaryLines.type === 'Polygon') {
              boundaryLines.coordinates[0].forEach(([lng, lat]) => {
                bounds.extend([lng, lat]);
              });
            } else if (boundaryLines.type === 'MultiPolygon') {
              boundaryLines.coordinates[0][0].forEach(([lng, lat]) => {
                bounds.extend([lng, lat]);
              });
            }

            mapInstance.fitBounds(bounds, {
              padding: 40,
              duration: 1000,
            });
          } else if (coordinates) {
            // Fly to the city location with smooth animation
            setTimeout(() => {
              mapInstance.flyTo({
                center: [coordinates.lng, coordinates.lat],
                zoom: 13,
                duration: 1500,
              });
            }, 100);
          }

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
        console.error('Error initializing city map:', error);
      }
    };

    initMap();
  }, [coordinates, boundaryLines, cityName]);

  if (!boundaryLines && (!coordinates || !coordinates.lat || !coordinates.lng)) {
    return null;
  }

  return (
    <div className={`rounded-md border border-gray-200 overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}





