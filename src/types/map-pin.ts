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


export interface MapPin {
  id: string;
  map_id: string; // Map this pin belongs to (required)
  lat: number;
  lng: number;
  description: string | null; // Used by mentions
  caption: string | null; // Used by custom map pins
  emoji: string | null; // Used by custom map pins
  type: string | null;
  media_url: string | null;
  image_url: string | null; // Used by mentions
  video_url: string | null; // Used by mentions
  media_type?: 'image' | 'video' | 'none'; // Used by mentions
  account_id: string | null;
  city_id: string | null;
  county_id: string | null;
  visibility: MapPinVisibility;
  archived?: boolean; // Soft delete flag - true means pin is archived
  is_active?: boolean; // Active flag - false means pin is soft-deleted
  view_count?: number;
  post_date?: string | null; // Used by mentions (for year filtering)
  location_metadata?: LocationMetadata | null;
  map_meta?: Record<string, any> | null; // Used by mentions
  atlas_meta?: Record<string, any> | null; // Used by mentions
  full_address?: string | null; // Used by mentions
  icon_url?: string | null; // Used by mentions
  collection_id?: string | null; // Used by mentions
  mention_type_id?: string | null; // Used by mentions
  tagged_account_ids?: string[] | null; // Used by mentions (JSONB array)
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
  archived?: boolean; // Set to true to archive the pin (soft delete)
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



