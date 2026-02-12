'use client';

import { useEffect, useState, useRef } from 'react';
import { useDynamicMap } from '@/hooks/useDynamicMap';
import MapIDBox from '@/app/map/[id]/components/MapIDBox';
import { MapboxMapInstance } from '@/types/mapbox';

interface DynamicMapContainerProps {
  /** Map identifier: UUID or slug */
  identifier: string;
  /** Map style */
  mapStyle?: 'street' | 'satellite' | 'light' | 'dark';
  /** Show pins */
  showPins?: boolean;
  /** Cluster pins */
  clusterPins?: boolean;
  /** Show only my pins */
  showOnlyMyPins?: boolean;
  /** Admin view */
  /** Callback when map loads */
  onMapLoad?: (map: MapboxMapInstance) => void;
  /** Callback when pin is selected */
  onPinSelect?: (pinId: string, pinData?: any) => void;
  /** Callback for click reports */
  onClickReport?: (lat: number, lng: number) => void;
  /** Boundary layers */
  showDistricts?: boolean;
  showCTU?: boolean;
  showStateBoundary?: boolean;
  showCountyBoundaries?: boolean;
  /** Pin display grouping */
  pinDisplayGrouping?: boolean;
  /** Time filter */
  timeFilter?: string | null;
}

/**
 * Dynamic Map Container
 * Renders any map by ID or slug using the unified MapIDBox component
 */
export default function DynamicMapContainer({
  identifier,
  mapStyle = 'street',
  showPins = true,
  clusterPins = true,
  showOnlyMyPins = false,
  onMapLoad,
  onPinSelect,
  onClickReport,
  showDistricts = false,
  showCTU = false,
  showStateBoundary = false,
  showCountyBoundaries = false,
  pinDisplayGrouping = true,
  timeFilter = null,
}: DynamicMapContainerProps) {
  const { map, pins, loading, error, shouldRender } = useDynamicMap({
    identifier,
    autoLoad: true,
    pinsLimit: 100,
  });

  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);

  // Handle map load callback
  useEffect(() => {
    if (mapInstanceRef.current && onMapLoad) {
      onMapLoad(mapInstanceRef.current);
    }
  }, [mapInstanceRef.current, onMapLoad]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-sm text-foreground-muted">Loading map...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!shouldRender || !map) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-sm text-foreground-muted">Map not found</div>
      </div>
    );
  }

  // Determine if this is the live map
  const isLiveMap = map.slug === 'live';

  return (
    <MapIDBox
      mapStyle={mapStyle}
      mapId={map.id}
      isOwner={false} // TODO: Check ownership from auth
      isLiveMap={isLiveMap}
      onLivePinSelect={onPinSelect}
      onLiveClickReport={onClickReport}
      showDistricts={showDistricts}
      showCTU={showCTU}
      showStateBoundary={showStateBoundary}
      showCountyBoundaries={showCountyBoundaries}
      title={map.name}
      description={map.description || null}
      visibility={map.visibility as 'public' | 'private' | 'shared'}
      allowPinsLoad={showPins}
      showPins={showPins}
      pinDisplayGrouping={pinDisplayGrouping}
      showOnlyMyPins={showOnlyMyPins}
      timeFilter={timeFilter}
      onMapLoad={(mapInstance) => {
        mapInstanceRef.current = mapInstance;
        if (onMapLoad) {
          onMapLoad(mapInstance);
        }
      }}
      initialPins={pins.map((pin) => ({
        id: pin.id,
        lat: pin.lat || 0,
        lng: pin.lng || 0,
        description: pin.description || null,
        image_url: pin.image_url || null,
        account: pin.account || null,
        mention_type: pin.mention_type || null,
        created_at: pin.created_at,
      }))}
    />
  );
}
