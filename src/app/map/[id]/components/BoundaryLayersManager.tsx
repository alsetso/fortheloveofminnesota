'use client';

import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface BoundaryLayersManagerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  showDistricts: boolean;
  showCTU: boolean;
  showStateBoundary: boolean;
  showCountyBoundaries: boolean;
}

/**
 * Consolidated component for managing all boundary layers
 * Replaces 4 separate layer components with unified management
 */
export default function BoundaryLayersManager({
  map,
  mapLoaded,
  showDistricts,
  showCTU,
  showStateBoundary,
  showCountyBoundaries,
}: BoundaryLayersManagerProps) {
  return (
    <>
      {showDistricts && (
        <CongressionalDistrictsLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showDistricts}
        />
      )}
      {showCTU && (
        <CTUBoundariesLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showCTU}
        />
      )}
      {showCountyBoundaries && (
        <CountyBoundariesLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showCountyBoundaries}
        />
      )}
      {showStateBoundary && (
        <StateBoundaryLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showStateBoundary}
        />
      )}
    </>
  );
}
