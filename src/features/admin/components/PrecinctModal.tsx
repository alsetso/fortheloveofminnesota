'use client';

import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface PrecinctModalProps {
  isOpen: boolean;
  onClose: () => void;
  precinct: {
    feature: any;
    district: any;
    properties: any;
  } | null;
}

export default function PrecinctModal({ isOpen, onClose, precinct }: PrecinctModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || !precinct || !mapContainerRef.current || map) return;

    let mounted = true;

    const initMap = async () => {
      try {
        await loadMapboxGL();
        const mapbox = (await import('mapbox-gl')).default;
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainerRef.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainerRef.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
        });

        mapInstance.on('load', () => {
          if (!mounted) return;
          setMapLoaded(true);
          setMap(mapInstance as MapboxMapInstance);

          // Add the precinct feature to the map
          const sourceId = 'precinct-source';
          const fillLayerId = 'precinct-fill';
          const outlineLayerId = 'precinct-outline';

          // Create FeatureCollection with just this precinct
          mapInstance.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [precinct.feature],
            },
          });

          // Add fill layer
          mapInstance.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#3b82f6',
              'fill-opacity': 0.3,
            },
          });

          // Add outline layer
          mapInstance.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#3b82f6',
              'line-width': 3,
            },
          });

          // Fit bounds to the precinct
          const geometry = precinct.feature.geometry;
          if (geometry.type === 'Polygon' && geometry.coordinates[0]) {
            const bounds = new mapbox.LngLatBounds();
            geometry.coordinates[0].forEach((coord: number[]) => {
              if (coord.length >= 2) {
                bounds.extend([coord[0], coord[1]]);
              }
            });
            mapInstance.fitBounds(bounds, {
              padding: 50,
              duration: 1000,
            });
          } else if (geometry.type === 'MultiPolygon') {
            const bounds = new mapbox.LngLatBounds();
            geometry.coordinates.forEach((polygon: number[][][]) => {
              if (polygon[0]) {
                polygon[0].forEach((coord: number[]) => {
                  if (coord.length >= 2) {
                    bounds.extend([coord[0], coord[1]]);
                  }
                });
              }
            });
            mapInstance.fitBounds(bounds, {
              padding: 50,
              duration: 1000,
            });
          }
        });
      } catch (err) {
        console.error('[PrecinctModal] Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (map) {
        const mapboxMap = map as any;
        try {
          if (mapboxMap.getLayer('precinct-fill')) mapboxMap.removeLayer('precinct-fill');
          if (mapboxMap.getLayer('precinct-outline')) mapboxMap.removeLayer('precinct-outline');
          if (mapboxMap.getSource('precinct-source')) mapboxMap.removeSource('precinct-source');
          mapboxMap.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        setMap(null);
        setMapLoaded(false);
      }
    };
  }, [isOpen, precinct, map]);

  if (!isOpen || !precinct) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl h-[80vh] bg-white rounded-lg shadow-xl pointer-events-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {precinct.properties.Precinct || 'Precinct'}
            </h2>
            <p className="text-sm text-gray-500">
              Congressional District {precinct.district.district_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="w-full h-full rounded-b-lg" />
        </div>

        {/* Precinct Info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 max-h-32 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {Object.entries(precinct.properties).map(([key, value]) => (
              <div key={key}>
                <span className="font-medium text-gray-600">{key}:</span>{' '}
                <span className="text-gray-900">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

