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
  visibility: MentionVisibility;
  archived?: boolean;
  post_date?: string | null; // Date when the event/memory happened (for year filtering)
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
}

export interface CreateMentionData {
  lat: number;
  lng: number;
  description?: string | null;
  city_id?: string | null; // Optional city ID - can be set during creation or auto-detected
  visibility?: MentionVisibility;
  post_date?: string | null; // ISO date string - can be up to 100 years in the past
}

export interface MentionFilters {
  account_id?: string;
  city_id?: string; // Filter by city ID
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
  };
}

/**
 * GeoJSON FeatureCollection for mentions
 */
export interface MentionGeoJSONCollection {
  type: 'FeatureCollection';
  features: MentionGeoJSONFeature[];
}

