'use client';

import { useEffect } from 'react';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import { getLiveBoundaryZoomRange } from '@/features/map/config';
import { preloadAll } from '@/features/map/services/liveBoundaryCache';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface BoundaryLayersManagerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  showDistricts: boolean;
  showCTU: boolean;
  showStateBoundary: boolean;
  showCountyBoundaries: boolean;
  /** When true (e.g. /live), all boundary layers are mounted with minzoom/maxzoom; Mapbox hides by zoom. No unmount on zoom = no refetch, smooth transitions. */
  liveMapBoundaryZoom?: boolean;
  /** Called when a boundary layer load starts (true) or finishes (false). For Review accordion on /live. */
  onLayerLoadChange?: (layerId: 'state' | 'county' | 'district' | 'ctu', loading: boolean) => void;
  /** Called when a boundary is clicked. Single item for toggle selection; passed to /live footer. */
  onBoundarySelect?: (item: { layer: 'state' | 'county' | 'district' | 'ctu'; id: string; name: string; lat: number; lng: number }) => void;
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
  liveMapBoundaryZoom = false,
  onLayerLoadChange,
  onBoundarySelect,
}: BoundaryLayersManagerProps) {
  // Preload boundary data ONLY when layers are actually visible and live map is active
  // Do NOT preload on initial load - wait for user to toggle layers on
  useEffect(() => {
    if (liveMapBoundaryZoom && mapLoaded && (showDistricts || showCTU || showStateBoundary || showCountyBoundaries)) {
      preloadAll();
    }
  }, [liveMapBoundaryZoom, mapLoaded, showDistricts, showCTU, showStateBoundary, showCountyBoundaries]);

  const zoomRange = (layer: 'state' | 'county' | 'district' | 'ctu') =>
    liveMapBoundaryZoom ? getLiveBoundaryZoomRange(layer) : {};

  // Render order = draw order: first component adds layers at bottom, last on top.
  // We want most specific boundaries on top so clicks hit district > CTU > county > state.
  return (
    <>
      {showStateBoundary && (
        <StateBoundaryLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showStateBoundary}
          {...(liveMapBoundaryZoom && { ...zoomRange('state'), fillColor: '#ef4444' })}
          {...(liveMapBoundaryZoom && onLayerLoadChange && { onLoadChange: (loading) => onLayerLoadChange('state', loading) })}
          {...(onBoundarySelect && { onBoundarySelect })}
        />
      )}
      {showCountyBoundaries && (
        <CountyBoundariesLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showCountyBoundaries}
          {...(liveMapBoundaryZoom && zoomRange('county'))}
          {...(liveMapBoundaryZoom && onLayerLoadChange && { onLoadChange: (loading) => onLayerLoadChange('county', loading) })}
          {...(onBoundarySelect && { onBoundarySelect })}
        />
      )}
      {showCTU && (
        <CTUBoundariesLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showCTU}
          {...(liveMapBoundaryZoom && zoomRange('ctu'))}
          {...(liveMapBoundaryZoom && onLayerLoadChange && { onLoadChange: (loading) => onLayerLoadChange('ctu', loading) })}
          {...(onBoundarySelect && { onBoundarySelect })}
        />
      )}
      {showDistricts && (
        <CongressionalDistrictsLayer
          map={map}
          mapLoaded={mapLoaded}
          visible={showDistricts}
          {...(liveMapBoundaryZoom && zoomRange('district'))}
          {...(liveMapBoundaryZoom && onLayerLoadChange && { onLoadChange: (loading) => onLayerLoadChange('district', loading) })}
          {...(onBoundarySelect && { onBoundarySelect })}
        />
      )}
    </>
  );
}
