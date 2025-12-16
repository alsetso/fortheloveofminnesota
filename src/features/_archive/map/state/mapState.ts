/**
 * Lightweight map state store
 * Simple object-based state management
 */

export interface MapState {
  mapInfo: {
    zoom: number;
    center: { lat: number; lng: number };
    cursor: { lat: number; lng: number };
    bearing: number;
    pitch: number;
  };
  mapLoaded: boolean;
  userLocation: { lat: number; lng: number } | null;
}

const defaultState: MapState = {
  mapInfo: {
    zoom: 5,
    center: { lat: 46.7296, lng: -94.6859 },
    cursor: { lat: 0, lng: 0 },
    bearing: 0,
    pitch: 0,
  },
  mapLoaded: false,
  userLocation: null,
};

/**
 * Create a new map state instance
 */
export function createMapState(): MapState {
  return { ...defaultState };
}

/**
 * Update map info in state
 */
export function updateMapInfo(
  state: MapState,
  mapInfo: Partial<MapState['mapInfo']>
): MapState {
  return {
    ...state,
    mapInfo: {
      ...state.mapInfo,
      ...mapInfo,
    },
  };
}

/**
 * Set map loaded state
 */
export function setMapLoaded(state: MapState, loaded: boolean): MapState {
  return {
    ...state,
    mapLoaded: loaded,
  };
}

/**
 * Set user location
 */
export function setUserLocation(
  state: MapState,
  location: { lat: number; lng: number } | null
): MapState {
  return {
    ...state,
    userLocation: location,
  };
}



