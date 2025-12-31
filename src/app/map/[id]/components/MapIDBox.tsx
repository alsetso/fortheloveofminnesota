'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMapboxMap } from '../hooks/useMapboxMap';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import MapPinForm from './MapPinForm';

interface MapIDBoxProps {
  mapStyle: 'street' | 'satellite' | 'light' | 'dark';
  mapId: string;
  isOwner: boolean;
  meta?: {
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
  } | null;
  onMapLoad?: (map: MapboxMapInstance) => void;
}

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

const PINS_SOURCE_ID = 'map-pins';
const PINS_LAYER_ID = 'map-pins-points';

export default function MapIDBox({ mapStyle, mapId, isOwner, meta, onMapLoad }: MapIDBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const { mapInstance, mapLoaded } = useMapboxMap({
    mapStyle,
    containerRef: mapContainer,
    meta,
    onMapLoad,
  });
  const [pins, setPins] = useState<MapPin[]>([]);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinFormCoords, setPinFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const clickHandlerAddedRef = useRef(false);

  // Apply meta settings to map
  useEffect(() => {
    if (!mapInstance || !mapLoaded || !meta) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    // Apply pitch
    if (meta.pitch !== undefined) {
      mapboxMap.setPitch(meta.pitch);
    }

    // Apply buildings
    if (meta.buildingsEnabled) {
      addBuildingExtrusions(mapInstance, { opacity: 0.6 });
    } else {
      removeBuildingExtrusions(mapInstance);
    }

    // Note: Terrain would be applied here if needed
  }, [mapInstance, mapLoaded, meta]);

  // Fetch pins
  useEffect(() => {
    if (!mapLoaded || !mapId) return;

    const fetchPins = async () => {
      try {
        const response = await fetch(`/api/maps/${mapId}/pins`);
        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            // Map not found or no access - set empty pins
            setPins([]);
            return;
          }
          console.error('Failed to fetch pins:', response.statusText);
          return;
        }
        const data = await response.json();
        setPins(data.pins || []);
      } catch (err) {
        console.error('Error fetching pins:', err);
        setPins([]); // Set empty on error to prevent retry loops
      }
    };

    fetchPins();
  }, [mapLoaded, mapId]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: pins
        .filter(pin => pin.lat !== null && pin.lng !== null && !isNaN(pin.lat) && !isNaN(pin.lng))
        .map((pin) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [pin.lng, pin.lat] as [number, number],
          },
          properties: {
            id: pin.id,
            emoji: pin.emoji || '📍',
            caption: pin.caption || '',
          },
        })),
    };
    
    // If no valid pins, remove source/layer if they exist
    if (geoJSON.features.length === 0) {
      try {
        const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
        if (existingSource) {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          mapboxMap.removeSource(PINS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    try {
      // Check if source exists
      const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
      if (existingSource) {
        (existingSource as any).setData(geoJSON);
        return;
      }

      // Add source
      mapboxMap.addSource(PINS_SOURCE_ID, {
        type: 'geojson',
        data: geoJSON,
      });

      // Add layer
      mapboxMap.addLayer({
        id: PINS_LAYER_ID,
        type: 'circle',
        source: PINS_SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    } catch (err) {
      console.error('Error adding pins to map:', err);
    }
  }, [mapLoaded, mapInstance, pins]);

  // Handle map clicks for pin creation (owner only)
  useEffect(() => {
    if (!mapLoaded || !mapInstance || !isOwner || clickHandlerAddedRef.current) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handleMapClick = (e: any) => {
      // Don't create pin if clicking on existing pin
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [PINS_LAYER_ID],
      });
      if (features.length > 0) return;

      const { lng, lat } = e.lngLat;
      setPinFormCoords({ lat, lng });
      setShowPinForm(true);
    };

    mapboxMap.on('click', handleMapClick);
    
    // Change cursor to pointer when owner
    const canvas = mapboxMap.getCanvas();
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }
    
    clickHandlerAddedRef.current = true;

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', handleMapClick);
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
      clickHandlerAddedRef.current = false;
    };
  }, [mapLoaded, isOwner, mapInstance]);

  // Cleanup pins layer and source on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        const mapboxMap = mapInstance as any;
        try {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          if (mapboxMap.getSource(PINS_SOURCE_ID)) {
            mapboxMap.removeSource(PINS_SOURCE_ID);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [mapInstance]);

  // Handle pin creation
  const handleCreatePin = useCallback(async (data: {
    emoji: string | null;
    caption: string | null;
    image_url: string | null;
    video_url: string | null;
  }) => {
    if (!pinFormCoords) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          lat: pinFormCoords.lat,
          lng: pinFormCoords.lng,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create pin';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const newPin = await response.json();
      // Refresh pins list to get complete data
      const refreshResponse = await fetch(`/api/maps/${mapId}/pins`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setPins(refreshData.pins || []);
      } else {
        // Fallback: add new pin to list
        setPins((prev) => [newPin, ...prev]);
      }
      setShowPinForm(false);
      setPinFormCoords(null);
    } catch (err) {
      throw err;
    }
  }, [mapId, pinFormCoords]);

  return (
    <div className="flex-1 relative">
      <div 
        ref={mapContainer} 
        className="w-full h-full"
        style={{ margin: 0, padding: 0 }}
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-gray-600 text-xs font-medium">Loading map...</div>
          </div>
        </div>
      )}
      {showPinForm && pinFormCoords && (
        <MapPinForm
          isOpen={showPinForm}
          lat={pinFormCoords.lat}
          lng={pinFormCoords.lng}
          mapId={mapId}
          onClose={() => {
            setShowPinForm(false);
            setPinFormCoords(null);
          }}
          onSubmit={handleCreatePin}
          onPinCreated={async (pinId) => {
            // Refresh pins after creation
            try {
              const response = await fetch(`/api/maps/${mapId}/pins`);
              if (response.ok) {
                const data = await response.json();
                setPins(data.pins || []);
              }
            } catch (err) {
              console.error('Error refreshing pins:', err);
            }
          }}
        />
      )}
    </div>
  );
}

