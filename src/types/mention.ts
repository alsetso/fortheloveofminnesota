/**
 * TypeScript types for mentions
 */

export type MentionVisibility = 'public' | 'only_me';

export interface Mention {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  account_id: string | null;
  city_id: string | null; // City ID for filtering mentions by city
  collection_id: string | null; // Collection ID for categorizing mentions
  visibility: MentionVisibility;
  archived?: boolean;
  post_date?: string | null; // Date when the event/memory happened (for year filtering)
  map_meta?: Record<string, any> | null; // JSON metadata containing all location details from the map
  atlas_meta?: Record<string, any> | null; // JSON metadata containing atlas entity details (parks, schools, cities, etc.) when mention is created on an atlas pin
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
  collection?: {
    id: string;
    emoji: string;
    title: string;
  } | null;
}

export interface CreateMentionData {
  lat: number;
  lng: number;
  description?: string | null;
  city_id?: string | null; // Optional city ID - can be set during creation or auto-detected
  collection_id?: string | null; // Optional collection ID for categorizing mentions
  visibility?: MentionVisibility;
  post_date?: string | null; // ISO date string - can be up to 100 years in the past
  map_meta?: Record<string, any> | null; // JSON metadata containing all location details from the map
  atlas_meta?: Record<string, any> | null; // JSON metadata containing atlas entity details when mention is created on an atlas pin
}

export interface MentionFilters {
  account_id?: string;
  city_id?: string; // Filter by city ID
  collection_id?: string; // Filter by collection ID
  year?: number; // Filter by year of post_date
  bbox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

/**
 * GeoJSON Feature for a mention
 */
export interface MentionGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    description: string | null;
    account_id: string | null;
    collection_emoji: string | null;
  };
}

/**
 * GeoJSON FeatureCollection for mentions
 */
export interface MentionGeoJSONCollection {
  type: 'FeatureCollection';
  features: MentionGeoJSONFeature[];
}

