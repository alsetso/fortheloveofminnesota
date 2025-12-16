import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { Marker } from 'mapbox-gl';
import { shouldIgnoreMapClick } from '../utils/mapEventHelpers';

export interface MapEventHandlers {
  onMapClick?: (coordinates: { lat: number; lng: number }, map: MapboxMap) => void;
  onMarkerClick?: (markerId: string) => void;
  onPopupClick?: (popupId: string) => void;
}

export interface RegisterMapEventsOptions {
  map: MapboxMap;
  markers: Map<string, Marker>;
  onMapClick?: (coordinates: { lat: number; lng: number }, map: MapboxMap) => void;
}

export interface MapEventHandlersResult {
  handlers: {
    click: (e: MapMouseEvent) => void;
    zoom: () => void;
    move: () => void;
    rotate: () => void;
    pitch: () => void;
  };
  cleanup: () => void;
}

/**
 * Register all map event listeners
 */
export function registerMapEvents(
  options: RegisterMapEventsOptions
): MapEventHandlersResult {
  const { map, markers, onMapClick } = options;

  // Click handler
  const handleClick = (e: MapMouseEvent) => {
    // Check if click should be ignored (marker/popup)
    if (shouldIgnoreMapClick(e, markers)) {
      return;
    }

    // Forward to callback with map instance
    onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, map);
  };

  // Zoom handler
  const handleZoom = () => {
    // Zoom tracking is handled by mapInfoController
  };

  // Move handler
  const handleMove = () => {
    // Move tracking is handled by mapInfoController
  };

  // Rotate handler
  const handleRotate = () => {
    // Rotation tracking is handled by mapInfoController
  };

  // Pitch handler
  const handlePitch = () => {
    // Pitch tracking is handled by mapInfoController
  };

  // Register event listeners
  map.on('click', handleClick);
  map.on('zoom', handleZoom);
  map.on('move', handleMove);
  map.on('rotate', handleRotate);
  map.on('pitch', handlePitch);

  return {
    handlers: {
      click: handleClick,
      zoom: handleZoom,
      move: handleMove,
      rotate: handleRotate,
      pitch: handlePitch,
    },
    cleanup: () => {
      map.off('click', handleClick);
      map.off('zoom', handleZoom);
      map.off('move', handleMove);
      map.off('rotate', handleRotate);
      map.off('pitch', handlePitch);
    },
  };
}

/**
 * Unregister map event listeners
 */
export function unregisterMapEvents(handlers: MapEventHandlersResult): void {
  handlers.cleanup();
}

