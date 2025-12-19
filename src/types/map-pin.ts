/**
 * TypeScript types for public map pins
 */

export type MapPinVisibility = 'public' | 'only_me';

// Mapbox feature metadata captured at pin creation
export interface LocationMetadata {
  layerId: string;
  sourceLayer: string | null;
  name: string | null;
  category: string;
  class?: string | null;
  type?: string | null;
  properties: Record<string, any>;
}

// Atlas entity metadata captured at pin creation
export interface AtlasMetadata {
  entityId: string;
  entityType: string;
  name: string;
  emoji?: string;
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  type: string | null;
  media_url: string | null;
  account_id: string | null;
  city_id: string | null;
  county_id: string | null;
  visibility: MapPinVisibility;
  archived?: boolean; // Soft delete flag - true means pin is archived
  view_count?: number;
  location_metadata?: LocationMetadata | null;
  atlas_metadata?: AtlasMetadata | null;
  event_date?: string | null; // Date when the event/memory happened (can be in the past)
  hide_location?: boolean; // When true, uses city coordinates instead of exact coordinates
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
}

export interface CreateMapPinData {
  lat: number;
  lng: number;
  description?: string | null;
  media_url?: string | null;
  post_id?: string | null;
  city_id?: string | null;
  county_id?: string | null;
  visibility?: MapPinVisibility;
  tags?: string[]; // User-defined labels for organizing pins
  location_metadata?: LocationMetadata | null;
  atlas_metadata?: AtlasMetadata | null;
  event_date?: string | null; // ISO date string - can be up to 100 years in the past
  hide_location?: boolean; // When true, uses city coordinates instead of exact coordinates
}

export interface UpdateMapPinData {
  lat?: number;
  lng?: number;
  description?: string | null;
  media_url?: string | null;
  city_id?: string | null;
  county_id?: string | null;
  tags?: string[]; // User-defined labels for organizing pins
  event_date?: string | null; // ISO date string - can be up to 100 years in the past
}

export interface MapPinFilters {
  account_id?: string;
  year?: number; // Filter by year of event_date
  bbox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

/**
 * GeoJSON Feature for a map pin
 */
export interface MapPinGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    description: string | null;
    media_url: string | null;
    account_id: string | null;
    city_id: string | null;
    county_id: string | null;
  };
}

/**
 * GeoJSON FeatureCollection for map pins
 */
export interface MapPinGeoJSONCollection {
  type: 'FeatureCollection';
  features: MapPinGeoJSONFeature[];
}



