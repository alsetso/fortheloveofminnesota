import type { Map as MapboxMap, Marker, MarkerOptions } from 'mapbox-gl';
import { loadMapboxGL } from '../utils/mapboxLoader';
import { validateCoordinateObject } from '../utils/mapValidation';

export interface CreateMarkerOptions {
  color?: string;
  element?: HTMLElement;
  popupContent?: string;
  onPopupCreate?: (popup: import('mapbox-gl').Popup, markerId: string) => void;
}

export interface MarkerController {
  createMarker: (
    id: string,
    coordinates: { lat: number; lng: number },
    options?: CreateMarkerOptions
  ) => Promise<void>;
  removeMarker: (id: string) => void;
  clearAllMarkers: () => void;
  updateMarker: (
    id: string,
    coordinates?: { lat: number; lng: number },
    options?: Partial<CreateMarkerOptions>
  ) => void;
  getMarker: (id: string) => Marker | undefined;
  getMarkers: () => Map<string, Marker>;
}

/**
 * Create marker controller instance
 */
export function createMarkerController(map: MapboxMap): MarkerController {
  const markers = new Map<string, Marker>();

  const createMarker = async (
    id: string,
    coordinates: { lat: number; lng: number },
    options: CreateMarkerOptions = {}
  ): Promise<void> => {
    if (!map || map.removed) return;

    // Validate coordinates
    if (!validateCoordinateObject(coordinates)) {
      return;
    }

    try {
      const mapbox = await loadMapboxGL();

      // Remove existing marker if it exists
      const existingMarker = markers.get(id);
      if (existingMarker) {
        existingMarker.remove();
        markers.delete(id);
      }

      // Create marker options
      const markerOptions: Partial<MarkerOptions> = {
        anchor: 'center',
      };

      if (options.element) {
        markerOptions.element = options.element;
      } else if (options.color) {
        markerOptions.color = options.color;
      }

      // Create marker
      const marker = new mapbox.Marker(markerOptions).setLngLat([
        coordinates.lng,
        coordinates.lat,
      ]);

      // Add popup if provided
      if (options.popupContent) {
        const popup = new mapbox.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
          className: 'pin-popup-container',
          maxWidth: '300px',
        }).setHTML(options.popupContent);
        marker.setPopup(popup);

        // Call popup creation callback
        options.onPopupCreate?.(popup, id);
      }

      // Add to map
      marker.addTo(map);
      markers.set(id, marker);
    } catch (err) {
      console.error('Error adding marker:', err);
    }
  };

  const removeMarker = (id: string): void => {
    const marker = markers.get(id);
    if (marker) {
      marker.remove();
      markers.delete(id);
    }
  };

  const clearAllMarkers = (): void => {
    markers.forEach((marker) => marker.remove());
    markers.clear();
  };

  const updateMarker = (
    id: string,
    coordinates?: { lat: number; lng: number },
    options?: Partial<CreateMarkerOptions>
  ): void => {
    const marker = markers.get(id);
    if (!marker) return;

    if (coordinates && validateCoordinateObject(coordinates)) {
      marker.setLngLat([coordinates.lng, coordinates.lat]);
    }

    // Update marker element if provided
    if (options?.element) {
      marker.setElement(options.element);
    }
  };

  const getMarker = (id: string): Marker | undefined => {
    return markers.get(id);
  };

  const getMarkers = (): Map<string, Marker> => {
    return markers;
  };

  return {
    createMarker,
    removeMarker,
    clearAllMarkers,
    updateMarker,
    getMarker,
    getMarkers,
  };
}



