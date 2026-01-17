'use client';

import type { MapboxMapInstance } from '@/types/mapbox-events';

interface LocationSecondaryContentProps {
  map?: MapboxMapInstance | null;
  mapLoaded?: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
}

export default function LocationSecondaryContent({ 
  map, 
  mapLoaded = false,
  onLocationSelect,
}: LocationSecondaryContentProps) {
  return (
    <div className="relative w-full p-[10px]">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          Location features coming soon.
        </p>
      </div>
    </div>
  );
}

