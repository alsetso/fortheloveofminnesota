/**
 * TypeScript types for user maps and points
 * 
 * These types are distinct from public map pins (MapPin) and are used
 * exclusively for user-created maps with points and sharing functionality.
 * 
 * @see /src/types/map-pin.ts for public map pin types
 */

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission level for map sharing
 * - 'view': Can view the map and its points
 * - 'edit': Can view and modify the map and its points
 */
export type MapPermission = 'view' | 'edit';

// ============================================================================
// User Map Types
// ============================================================================

/**
 * User-created map
 * 
 * Maps are private by default and belong to a specific account.
 * They can be shared with other accounts via map_shares.
 */
export interface UserMap {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data required to create a new user map
 */
export interface CreateUserMapData {
  title: string;
  description?: string | null;
}

/**
 * Data required to update an existing user map
 */
export interface UpdateUserMapData {
  title?: string;
  description?: string | null;
}

/**
 * User map with additional metadata (e.g., point count, share count)
 */
export interface UserMapWithMetadata extends UserMap {
  point_count?: number;
  share_count?: number;
  is_owner?: boolean;
  user_permission?: MapPermission | null;
}

// ============================================================================
// User Point Types
// ============================================================================

/**
 * Point on a user map
 * 
 * Points belong to a specific map and are created by a specific account.
 * They are distinct from public map pins (MapPin).
 */
export interface UserPoint {
  id: string;
  map_id: string;
  account_id: string;
  lat: number;
  lng: number;
  label: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data required to create a new point on a user map
 */
export interface CreateUserPointData {
  map_id: string;
  lat: number;
  lng: number;
  label?: string | null;
  description?: string | null;
}

/**
 * Data required to update an existing point on a user map
 */
export interface UpdateUserPointData {
  lat?: number;
  lng?: number;
  label?: string | null;
  description?: string | null;
}

// ============================================================================
// Map Share Types
// ============================================================================

/**
 * Share relationship between a map and an account
 * 
 * Represents that a map has been shared with an account
 * with a specific permission level.
 */
export interface MapShare {
  id: string;
  map_id: string;
  account_id: string;
  permission: MapPermission;
  created_at: string;
}

/**
 * Data required to create a new map share
 */
export interface CreateMapShareData {
  map_id: string;
  account_id: string;
  permission: MapPermission;
}

/**
 * Data required to update an existing map share (typically just permission)
 */
export interface UpdateMapShareData {
  permission: MapPermission;
}

/**
 * Map share with account information
 */
export interface MapShareWithAccount extends MapShare {
  account?: {
    id: string;
    username: string | null;
    display_name: string | null;
  };
}

// ============================================================================
// Access Control Types
// ============================================================================

/**
 * Access level for a user on a specific map
 */
export interface MapAccess {
  has_access: boolean;
  is_owner: boolean;
  permission: MapPermission | null;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Result of checking map access
 */
export interface MapAccessCheck {
  has_access: boolean;
  is_owner: boolean;
  permission: MapPermission | null;
}

// ============================================================================
// GeoJSON Types for User Points
// ============================================================================

/**
 * GeoJSON Feature for a user point
 */
export interface UserPointGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    map_id: string;
    account_id: string;
    label: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
  };
}

/**
 * GeoJSON FeatureCollection for user points
 */
export interface UserPointGeoJSONCollection {
  type: 'FeatureCollection';
  features: UserPointGeoJSONFeature[];
}

// ============================================================================
// Query/Filter Types
// ============================================================================

/**
 * Filters for querying user maps
 */
export interface UserMapFilters {
  account_id?: string;
  map_id?: string;
  include_shared?: boolean;
  permission?: MapPermission;
}

/**
 * Filters for querying user points
 */
export interface UserPointFilters {
  map_id: string;
  account_id?: string;
  bbox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

/**
 * Filters for querying map shares
 */
export interface MapShareFilters {
  map_id?: string;
  account_id?: string;
  permission?: MapPermission;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid MapPermission
 */
export function isMapPermission(value: unknown): value is MapPermission {
  return value === 'view' || value === 'edit';
}

/**
 * Type guard to check if an object is a UserMap
 */
export function isUserMap(value: unknown): value is UserMap {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'account_id' in value &&
    'title' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).account_id === 'string' &&
    typeof (value as any).title === 'string'
  );
}

/**
 * Type guard to check if an object is a UserPoint
 */
export function isUserPoint(value: unknown): value is UserPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'map_id' in value &&
    'account_id' in value &&
    'lat' in value &&
    'lng' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).map_id === 'string' &&
    typeof (value as any).account_id === 'string' &&
    typeof (value as any).lat === 'number' &&
    typeof (value as any).lng === 'number'
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper type for map operations that require authentication
 */
export type AuthenticatedMapOperation<T> = T & {
  account_id: string;
};

/**
 * Helper type for point operations that require map context
 */
export type MapContextPointOperation<T> = T & {
  map_id: string;
};

/**
 * Response type for map list queries
 */
export interface UserMapListResponse {
  maps: UserMap[];
  total: number;
  owned_count: number;
  shared_count: number;
}

/**
 * Response type for point list queries
 */
export interface UserPointListResponse {
  points: UserPoint[];
  total: number;
}

/**
 * Response type for share list queries
 */
export interface MapShareListResponse {
  shares: MapShareWithAccount[];
  total: number;
}





