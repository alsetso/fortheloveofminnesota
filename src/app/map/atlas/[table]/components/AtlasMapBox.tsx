'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useMapboxMap } from '@/app/map/[id]/hooks/useMapboxMap';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import AtlasMapLayer, { type AtlasEntity } from '@/features/atlas/components/AtlasMapLayer';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';

interface AtlasMapBoxProps {
  tableName: string;
  mapStyle?: 'street' | 'satellite' | 'light' | 'dark';
  iconPath?: string | null;
  atlasName?: string;
}

export default function AtlasMapBox({ tableName, mapStyle = 'street', iconPath, atlasName }: AtlasMapBoxProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { mapInstance, mapLoaded } = useMapboxMap({
    mapStyle,
    containerRef: mapContainer as React.RefObject<HTMLDivElement>,
    meta: null,
  });
  const [entities, setEntities] = useState<AtlasEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<AtlasEntity | null>(null);
  const hasFetchedRef = useRef(false);

  // Fetch entities
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchEntities = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/atlas/${tableName}/entities`);
        if (response.ok) {
          const data = await response.json();
          setEntities(data.entities || []);
        }
      } catch (err) {
        console.error('Error fetching entities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [tableName]);

  // Listen for entity focus events from sidebar
  useEffect(() => {
    const handleFocus = (e: CustomEvent<{ lat: number; lng: number }>) => {
      if (mapInstance && mapLoaded) {
        const mapboxMap = mapInstance as any;
        mapboxMap.flyTo({
          center: [e.detail.lng, e.detail.lat],
          zoom: 15,
          duration: 1000,
        });
      }
    };

    window.addEventListener('atlas-entity-focus', handleFocus as EventListener);
    return () => {
      window.removeEventListener('atlas-entity-focus', handleFocus as EventListener);
    };
  }, [mapInstance, mapLoaded]);

  // Fit bounds to all entities when map loads
  useEffect(() => {
    if (!mapInstance || !mapLoaded || entities.length === 0 || loading) return;

    const fitBounds = async () => {
      const mapbox = await loadMapboxGL();
      const bounds = new mapbox.LngLatBounds();
      
      entities.forEach((entity) => {
        bounds.extend([entity.lng, entity.lat]);
      });

      const mapboxMap = mapInstance as any;
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.fitBounds(bounds, {
          padding: 40,
          duration: 1000,
        });
      }
    };

    fitBounds();
  }, [mapInstance, mapLoaded, entities, loading]);

  // Add building extrusions when map loads
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;
    addBuildingExtrusions(mapInstance);
  }, [mapInstance, mapLoaded]);

  // Handle entity click - fly to location and dispatch event
  const handleEntityClick = useCallback((entity: AtlasEntity) => {
    setSelectedEntity(entity);
    
    // Fly to location
    if (mapInstance && mapLoaded && entity.lat && entity.lng) {
      const mapboxMap = mapInstance as any;
      mapboxMap.flyTo({
        center: [entity.lng, entity.lat],
        zoom: 15,
        duration: 1000,
      });
    }
    
    // Dispatch event to show entity details in sidebar
    window.dispatchEvent(new CustomEvent('atlas-entity-select', {
      detail: { entityId: entity.id, tableName }
    }));
  }, [mapInstance, mapLoaded, tableName]);

  // Listen for search query changes and update entities
  useEffect(() => {
    const handleSearch = async (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (customEvent.detail?.query?.trim()) {
          params.set('search', customEvent.detail.query.trim());
        }
        const response = await fetch(`/api/atlas/${tableName}/entities?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setEntities(data.entities || []);
        }
      } catch (err) {
        console.error('Error fetching filtered entities:', err);
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('atlas-search', handleSearch);
    return () => {
      window.removeEventListener('atlas-search', handleSearch);
    };
  }, [tableName]);

  return (
    <div className="relative w-full h-full">
      {/* Floating Header */}
      {atlasName && (
        <div className="absolute top-3 left-3 z-50 bg-white/95 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-[10px] py-[10px]">
            {/* Back Arrow */}
            <button
              onClick={() => router.push('/maps')}
              className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              aria-label="Back to Maps"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>

            {/* Atlas Icon */}
            {iconPath && (
              <div className="flex-shrink-0 w-5 h-5 relative">
                <Image
                  src={iconPath}
                  alt={atlasName}
                  width={20}
                  height={20}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* Atlas Name */}
            <h1 className="text-xs font-semibold text-gray-900 truncate max-w-[200px]">
              {atlasName}
            </h1>
          </div>
        </div>
      )}

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
      {mapInstance && mapLoaded && (
        <AtlasMapLayer
          map={mapInstance}
          mapLoaded={mapLoaded}
          tableName={tableName}
          entities={entities}
          iconPath={iconPath}
          onEntityClick={handleEntityClick}
        />
      )}
    </div>
  );
}

