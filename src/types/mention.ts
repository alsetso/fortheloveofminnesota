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
  icon_url?: string | null; // URL to the icon image for this mention pin
  image_url?: string | null; // URL to user-uploaded image associated with this mention
  video_url?: string | null; // URL to user-uploaded video associated with this mention
  media_type?: 'image' | 'video' | 'none'; // Type of media attached to this mention
  full_address?: string | null; // Full address string from reverse geocoding
  map_meta?: Record<string, any> | null; // JSON metadata containing all location details from the map
  view_count?: number; // Total number of views for this mention
  likes_count?: number; // Total number of likes for this mention
  is_liked?: boolean; // Whether the current user has liked this mention
  tagged_account_ids?: string[] | null; // Array of account IDs for users tagged in this mention
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
    plan?: string | null;
  } | null;
  collection?: {
    id: string;
    emoji: string;
    title: string;
  } | null;
  mention_type?: {
    id: string;
    emoji: string;
    name: string;
  } | null;
}

export interface MentionLike {
  id: string;
  mention_id: string;
  account_id: string;
  created_at: string;
}

export interface CreateMentionData {
  lat: number;
  lng: number;
  description?: string | null;
  city_id?: string | null; // Optional city ID - can be set during creation or auto-detected
  collection_id?: string | null; // Optional collection ID for categorizing mentions
  mention_type_id?: string | null; // Optional mention type ID for categorizing mentions
  visibility?: MentionVisibility;
  post_date?: string | null; // ISO date string - can be up to 100 years in the past
  icon_url?: string | null; // URL to the icon image for this mention pin
  image_url?: string | null; // URL to user-uploaded image associated with this mention
  video_url?: string | null; // URL to user-uploaded video associated with this mention
  media_type?: 'image' | 'video' | 'none'; // Type of media attached to this mention
  full_address?: string | null; // Full address string from reverse geocoding
  map_meta?: Record<string, any> | null; // JSON metadata containing all location details from the map
  tagged_account_ids?: string[] | null; // Array of account IDs for users tagged in this mention (only accounts with account_taggable=true can be tagged)
}

export interface MentionFilters {
  account_id?: string;
  city_id?: string;
  map_id?: string; // Filter by city ID
  collection_id?: string; // Filter by collection ID
  mention_type_id?: string; // Filter by mention type ID (single)
  mention_type_ids?: string[]; // Filter by mention type IDs (multiple)
  year?: number; // Filter by year of post_date
  timeFilter?: '24h' | '7d' | 'all'; // Filter by time: last 24 hours, 7 days, or all
  visibility?: MentionVisibility; // Filter by visibility: 'public' or 'only_me'
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
    description?: string | null; // Optional - excluded for unauthenticated users
    account_id: string | null;
    collection_emoji: string | null;
    account_image_url: string | null;
    account_plan?: string | null; // Account plan for gold border on map pins
  };
}

/**
 * GeoJSON FeatureCollection for mentions
 */
export interface MentionGeoJSONCollection {
  type: 'FeatureCollection';
  features: MentionGeoJSONFeature[];
}

