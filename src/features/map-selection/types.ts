/**
 * Map Selection State Types
 * 
 * URL-based state management for map interactions.
 * Enables shareable links, deep linking, and browser history navigation.
 * 
 * URL patterns:
 * - /feed?sel=location&lat=44.9778&lng=-93.2650
 * - /feed?sel=pin&id=abc123
 * - /feed?sel=entity&type=city&id=xyz789
 */

// ═══════════════════════════════════════════════════════════════
// Core Types
// ═══════════════════════════════════════════════════════════════

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationData {
  coordinates: Coordinates;
  placeName?: string;
  address?: string;
  type?: 'map-click' | 'pin-click' | 'search';
  city?: string;
  county?: string;
}

export interface PinData {
  id: string;
  name: string;
  description?: string | null;
  media_url?: string | null;
  address?: string | null;
  coordinates: Coordinates;
  created_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
    guest_id?: string | null;
  } | null;
}

export interface FeatureMetadata {
  type: string;
  name?: string;
  properties: Record<string, unknown>;
}

export type AtlasEntityLayerType = 
  | 'cities' 
  | 'counties' 
  | 'neighborhoods' 
  | 'schools' 
  | 'parks' 
  | 'lakes' 
  | 'watertowers' 
  | 'cemeteries' 
  | 'golf_courses' 
  | 'hospitals' 
  | 'airports' 
  | 'churches' 
  | 'municipals';

export interface AtlasEntity {
  id: string;
  name: string;
  slug?: string;
  layerType: AtlasEntityLayerType;
  emoji: string;
  lat: number;
  lng: number;
  school_type?: string;
  park_type?: string;
  hospital_type?: string;
  church_type?: string;
  denomination?: string;
  course_type?: string;
  holes?: number;
  airport_type?: string;
  iata_code?: string;
  icao_code?: string;
  municipal_type?: string;
  description?: string;
  address?: string;
  phone?: string;
  website_url?: string;
  city_id?: string;
  county_id?: string;
  is_public?: boolean;
  district?: string;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════
// Selection State Machine (Discriminated Union)
// ═══════════════════════════════════════════════════════════════

export type MapSelection =
  | { type: 'none' }
  | { type: 'location'; data: LocationData; feature?: FeatureMetadata }
  | { type: 'pin'; data: PinData }
  | { type: 'atlas_entity'; data: AtlasEntity };

// ═══════════════════════════════════════════════════════════════
// URL Parameter Types
// ═══════════════════════════════════════════════════════════════

export type SelectionUrlType = 'location' | 'pin' | 'entity';

export interface SelectionUrlParams {
  sel?: SelectionUrlType;
  // Location params
  lat?: string;
  lng?: string;
  // Pin params
  pinId?: string;
  // Entity params
  entityType?: AtlasEntityLayerType;
  entityId?: string;
}

// ═══════════════════════════════════════════════════════════════
// Modal State Machine
// ═══════════════════════════════════════════════════════════════

export type ActiveModal =
  | { type: 'none' }
  | { type: 'intelligence'; context: LocationData | null }
  | { type: 'analytics'; pinId: string; pinName?: string }
  | { type: 'coming_soon'; feature: string }
  | { type: 'atlas_entity'; mode: 'create' | 'edit'; entityType: string; data?: unknown };

export type ModalUrlType = 'intelligence' | 'analytics' | 'atlas';

export interface ModalUrlParams {
  modal?: ModalUrlType;
  pinId?: string;
  entityType?: string;
  mode?: 'create' | 'edit';
}

// ═══════════════════════════════════════════════════════════════
// Hook Return Types
// ═══════════════════════════════════════════════════════════════

export interface UseMapSelectionReturn {
  selection: MapSelection;
  selectLocation: (data: LocationData, feature?: FeatureMetadata) => void;
  selectPin: (data: PinData) => void;
  selectAtlasEntity: (data: AtlasEntity) => void;
  clearSelection: () => void;
  isExpanded: boolean;
}

export interface UseModalManagerReturn {
  activeModal: ActiveModal;
  openIntelligence: (context: LocationData | null) => void;
  openAnalytics: (pinId: string, pinName?: string) => void;
  openComingSoon: (feature: string) => void;
  openAtlasEntity: (mode: 'create' | 'edit', entityType: string, data?: unknown) => void;
  closeModal: () => void;
}


