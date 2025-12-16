// Map feature types and unions
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  coordinates?: Coordinates;
}

export interface MapboxFeature {
  type: string;
  properties: Record<string, unknown>;
  context?: Array<{
    id: string;
    text: string;
  }>;
  text?: string;
  center?: [number, number];
  place_type?: string[];
  place_name?: string;
}

export interface GeocodingResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
  fullAddress: string;
  cachedAt?: number;
}

export interface AddressWithCoordinates extends Address {
  fullAddress: string;
}

// Node type unions for better type safety
export type NodeType = 'start' | 'api-result' | 'people-result' | 'address' | 'person' | 'userFound';

export interface BaseNode {
  id: string;
  type: NodeType;
  timestamp: number;
  mnNodeId: string;
  hasCompleted?: boolean;
}

export interface StartNode extends BaseNode {
  type: 'start';
  title: string;
  address?: Address | null;
  apiName?: string;
}

export interface ApiResultNode extends BaseNode {
  type: 'api-result';
  address?: Address;
  apiName: string;
  response: Record<string, unknown>;
}

export interface PeopleResultNode extends BaseNode {
  type: 'people-result';
  personId?: string;
  personData?: Record<string, unknown>;
  apiName: string;
  parentNodeId?: string;
  clickedEntityId?: string;
  clickedEntityData?: Record<string, unknown>;
}

export interface UserFoundNode extends BaseNode {
  type: 'userFound';
  coordinates?: Coordinates;
  address?: Address;
  locationHistory?: Array<{ t: number; lat: number; lng: number }>;
}

export type Node = StartNode | ApiResultNode | PeopleResultNode | UserFoundNode;

// Map state types
export interface MapState {
  mapLoaded: boolean;
  userLocation: Coordinates | null;
  isTracking: boolean;
  isInteractionsLocked: boolean;
  mapInfo: {
    zoom: number;
    center: { lat: number; lng: number };
    cursor: { lat: number; lng: number };
    bearing: number;
    pitch: number;
  };
}

export interface MapActions {
  findUserLocation: () => void;
  addAddressPin: (coordinates: { lat: number; lng: number }) => void;
  removeAddressPin: () => void;
  addUserMarker: (coordinates: { lat: number; lng: number }) => void;
  removeUserMarker: () => void;
  lockInteractions: () => void;
  unlockInteractions: () => void;
  setCursorStyle: (cursor: string) => void;
  flyTo: (coordinates: { lat: number; lng: number }, zoom?: number) => void;
  followUser: (enabled: boolean) => void;
  updateUserLocation: (coordinates: Coordinates | null) => void;
  triggerGeolocate: () => void;
  addMarker: (id: string, coordinates: { lat: number; lng: number }, options?: { element?: HTMLElement; color?: string; popupContent?: string }) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  updateMarkerPopup: (id: string, popupContent: string) => void;
  // Strategic controls
  zoomToMinnesota: () => void;
  flyFromGlobeToMinnesota: () => void;
  zoomToStrategic: (level: 'state' | 'region' | 'local') => void;
  changeMapStyle: (styleKey: 'streets' | 'satellite' | 'light' | 'dark' | 'outdoors') => Promise<void>;
  
}

export interface UseMapReturn extends MapState, MapActions {
  map: import('mapbox-gl').Map | null;
}

// Address sync types
export interface AddressSyncActions {
  onMapPinDropped: (coordinates: { lat: number; lng: number }) => Promise<{ success: boolean; error?: string }>;
  onStartNodeAddressChanged: (address: Omit<Address, 'coordinates'>) => Promise<void>;
  setTemporaryAddress: (address: Address | null) => void;
  getTemporaryAddress: () => Address | null;
}

export interface UseAddressSyncReturn extends AddressSyncActions {
  temporaryAddress: Address | null;
  isSyncing: boolean;
}

// User location tracking types
export interface UserLocationTrackerState {
  userLocation: Coordinates | null;
  isTracking: boolean;
  locationHistory: Array<{ t: number; lat: number; lng: number }>;
  watchId: number | null;
  error: string | null;
}

export interface UserLocationTrackerActions {
  startTracking: () => void;
  stopTracking: () => void;
  clearHistory: () => void;
  getCurrentLocation: () => Promise<Coordinates | null>;
}

export interface UseUserLocationTrackerReturn extends UserLocationTrackerState, UserLocationTrackerActions {}

