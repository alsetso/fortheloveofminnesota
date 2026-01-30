/**
 * Map Types - Updated for new map system redesign
 * 
 * Key changes:
 * - title → name
 * - custom_slug → slug
 * - Consolidated settings into settings JSONB
 * - Member-based access control (owner/manager/editor)
 * - Categories via map_categories table
 */

export interface MapTag {
  emoji: string;
  text: string;
}

export interface MapLayers {
  congressional_districts?: boolean;
  ctu_boundaries?: boolean;
  state_boundary?: boolean;
  county_boundaries?: boolean;
}

export interface MapMeta {
  screenshot_url?: string;
  buildingsEnabled?: boolean;
  pitch?: number;
  terrainEnabled?: boolean;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
}

export interface MapFilters {
  angle?: number; // 0-60 degrees (map pitch/3D angle)
  map_styles?: boolean; // Enable/disable map style selection
  global_layers?: boolean; // Enable/disable global layer toggles
}

/**
 * Map Settings Structure (stored in settings JSONB column)
 */
export interface MapSettings {
  appearance?: {
    map_style?: 'street' | 'satellite' | 'light' | 'dark';
    map_layers?: MapLayers;
    meta?: MapMeta;
    map_filters?: MapFilters;
  };
  collaboration?: {
    allow_pins?: boolean;
    allow_areas?: boolean;
    allow_posts?: boolean;
    allow_clicks?: boolean;
    pin_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
    area_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
    post_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
    click_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
    allowed_mention_types?: string[] | null; // Array of mention_type IDs that are allowed in this map (null/undefined = all types allowed)
    role_overrides?: {
      managers_can_edit?: boolean;
      editors_can_edit?: boolean;
    };
  };
  presentation?: {
    hide_creator?: boolean;
    is_featured?: boolean;
    show_map_filters_icon?: boolean; // Owner-controlled: show/hide map filters icon
  };
  membership?: {
    max_members?: number; // Owner-set limit (null/undefined = no limit, but still subject to plan limit)
  };
  colors?: {
    owner?: string; // Background color/gradient for owner role (default: gradient)
    manager?: string; // Background color/gradient for manager role (default: black)
    editor?: string; // Background color/gradient for editor role (default: black)
    'non-member'?: string; // Background color/gradient for non-member role (default: black)
  };
}

/**
 * Map Member Role
 */
export type MapMemberRole = 'owner' | 'manager' | 'editor';

/**
 * Map Member
 */
export interface MapMember {
  id: string;
  map_id: string;
  account_id: string;
  role: MapMemberRole;
  joined_at: string;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

/**
 * Map Membership Request
 */
export interface MapMembershipRequest {
  id: string;
  map_id: string;
  account_id: string;
  answers: Array<{ question_id: number; answer: string }>;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by_account_id: string | null;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

/**
 * Map Category
 */
export type MapCategory = 'community' | 'professional' | 'government' | 'atlas' | 'user';

/**
 * Map Boundary Type
 */
export type MapBoundary = 'statewide' | 'county' | 'city' | 'town' | 'district';

/**
 * Boundary Data Structure
 * Contains selected boundary details based on boundary type
 */
export interface BoundaryData {
  // For county boundary
  county_id?: string;
  county_name?: string;
  county_code?: string;
  
  // For city/town boundary
  city_id?: string;
  city_name?: string;
  ctu_id?: string;
  ctu_class?: 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY';
  
  // For district boundary
  district_number?: number;
  district_name?: string;
  district_id?: string;
}

/**
 * Full Map Data (from database)
 */
export interface MapData {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  slug: string;
  visibility: 'public' | 'private';
  settings: MapSettings;
  boundary: MapBoundary;
  boundary_data: BoundaryData | null;
  member_count: number;
  is_active: boolean;
  auto_approve_members: boolean;
  membership_rules: string | null;
  membership_questions: Array<{ id: number; question: string }>;
  cover_image_url: string | null;
  image_url: string | null;
  tags: MapTag[] | null;
  published_to_community?: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  account: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
  // Optional: current user's member role (if authenticated and member)
  current_user_role?: MapMemberRole | null;
  // Optional: categories (loaded separately)
  categories?: MapCategory[];
}

/**
 * Map Item (for listings/cards)
 */
export interface MapItem {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  visibility: 'public' | 'private';
  settings: MapSettings;
  boundary?: MapBoundary;
  boundary_data?: BoundaryData | null;
  member_count: number;
  view_count?: number;
  published_to_community?: boolean;
  published_at?: string | null;
  tags?: MapTag[] | null;
  thumbnail?: string;
  href?: string;
  requiresPro?: boolean;
  status?: 'active' | 'coming_soon' | 'unlisted';
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
  // Optional: current user's member role (if authenticated and member)
  current_user_role?: MapMemberRole | null;
  // Optional: categories
  categories?: MapCategory[];
  // Legacy properties for backward compatibility
  title?: string; // Legacy: use name instead
  map_type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null; // Legacy: use categories instead
  collection_type?: 'community' | 'professional' | 'user' | 'atlas' | 'gov' | null; // Legacy: use categories instead
  custom_slug?: string | null; // Legacy: use slug instead
}

/**
 * Helper type for backward compatibility during migration
 * Maps old structure to new structure
 */
export type LegacyMapData = Omit<MapData, 'name' | 'slug' | 'settings' | 'member_count'> & {
  title: string;
  custom_slug?: string | null;
  map_style?: 'street' | 'satellite' | 'light' | 'dark';
  map_layers?: MapLayers | null;
  meta?: MapMeta | null;
  allow_others_to_post_pins?: boolean;
  allow_others_to_add_areas?: boolean;
  allow_others_to_create_posts?: boolean;
  hide_creator?: boolean;
  is_primary?: boolean;
  type?: 'user' | 'community' | 'gov' | 'professional' | 'atlas' | 'user-generated' | null;
  collection_type?: 'community' | 'professional' | 'user' | 'atlas' | 'gov' | null;
};

/**
 * Helper functions to convert between old and new structures
 */
export function mapDataToLegacy(map: MapData): LegacyMapData {
  return {
    ...map,
    title: map.name,
    custom_slug: map.slug,
    map_style: map.settings.appearance?.map_style || 'street',
    map_layers: map.settings.appearance?.map_layers || null,
    meta: map.settings.appearance?.meta || null,
    allow_others_to_post_pins: map.settings.collaboration?.allow_pins || false,
    allow_others_to_add_areas: map.settings.collaboration?.allow_areas || false,
    allow_others_to_create_posts: map.settings.collaboration?.allow_posts || false,
    hide_creator: map.settings.presentation?.hide_creator || false,
    is_primary: map.settings.presentation?.is_featured || false,
  };
}

export function legacyMapDataToNew(legacy: LegacyMapData): MapData {
  return {
    ...legacy,
    name: legacy.title,
    slug: legacy.custom_slug || '',
    settings: {
      appearance: {
        map_style: legacy.map_style || 'street',
        map_layers: legacy.map_layers || undefined,
        meta: legacy.meta || undefined,
      },
      collaboration: {
        allow_pins: legacy.allow_others_to_post_pins || false,
        allow_areas: legacy.allow_others_to_add_areas || false,
        allow_posts: legacy.allow_others_to_create_posts || false,
      },
      presentation: {
        hide_creator: legacy.hide_creator || false,
        is_featured: legacy.is_primary || false,
      },
    },
    member_count: 0, // Will be populated from database
  } as MapData;
}
