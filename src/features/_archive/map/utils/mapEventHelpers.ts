import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { Marker } from 'mapbox-gl';

/**
 * Check if click target is a marker element
 */
export function isMarkerClick(target: HTMLElement): boolean {
  return target.closest('.mapboxgl-marker') !== null;
}

/**
 * Check if click target is a popup element
 */
export function isPopupClick(target: HTMLElement): boolean {
  return target.closest('.mapboxgl-popup') !== null;
}

/**
 * Check if click coordinates intersect with any marker
 */
export function hasMarkerAtPoint(
  event: MapMouseEvent,
  markers: Map<string, Marker>
): boolean {
  if (!event.originalEvent) return false;

  const clickX = event.originalEvent.clientX;
  const clickY = event.originalEvent.clientY;

  for (const marker of markers.values()) {
    const markerElement = marker.getElement();
    if (markerElement) {
      const rect = markerElement.getBoundingClientRect();
      if (
        clickX >= rect.left &&
        clickX <= rect.right &&
        clickY >= rect.top &&
        clickY <= rect.bottom
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determine if map click should be ignored (clicked on marker/popup)
 */
export function shouldIgnoreMapClick(
  event: MapMouseEvent,
  markers: Map<string, Marker>
): boolean {
  if (!event.originalEvent) return false;

  const target = event.originalEvent.target as HTMLElement;
  
  return (
    isMarkerClick(target) ||
    isPopupClick(target) ||
    hasMarkerAtPoint(event, markers)
  );
}

/**
 * Get click target type
 */
export function getClickTarget(
  event: MapMouseEvent,
  markers: Map<string, Marker>
): 'marker' | 'popup' | 'map' {
  if (!event.originalEvent) return 'map';

  const target = event.originalEvent.target as HTMLElement;
  
  if (isMarkerClick(target) || hasMarkerAtPoint(event, markers)) {
    return 'marker';
  }
  if (isPopupClick(target)) {
    return 'popup';
  }
  return 'map';
}



