'use client';

import FloatingMapContainer from '@/features/homepage/components/FloatingMapContainer';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface LocationSecondaryContentProps {
  map?: MapboxMapInstance | null;
  mapLoaded?: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  selectedAtlasEntity?: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  } | null;
  onAtlasEntityClear?: () => void;
}

export default function LocationSecondaryContent({ 
  map, 
  mapLoaded = false,
  onLocationSelect,
  selectedAtlasEntity,
  onAtlasEntityClear
}: LocationSecondaryContentProps) {
  return (
    <div className="relative w-full">
      <FloatingMapContainer
        map={map || null}
        mapLoaded={mapLoaded}
        isOpen={true}
        onLocationSelect={onLocationSelect}
        selectedAtlasEntity={selectedAtlasEntity}
        onAtlasEntityClear={onAtlasEntityClear}
      />
    </div>
  );
}

