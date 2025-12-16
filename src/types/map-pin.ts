/**
 * TypeScript types for public map pins
 */

export type MapPinVisibility = 'public' | 'only_me';

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
  view_count?: number;
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
}

export interface UpdateMapPinData {
  lat?: number;
  lng?: number;
  description?: string | null;
  media_url?: string | null;
  city_id?: string | null;
  county_id?: string | null;
}

export interface MapPinFilters {
  account_id?: string;
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


