/**
 * Service for managing user maps
 * 
 * Handles CRUD operations for user-created maps, including:
 * - Creating, reading, updating, deleting maps
 * - Checking access permissions
 * - Managing map shares
 * 
 * All operations require authentication and proper account setup.
 */

import { supabase } from '@/lib/supabase';
import type {
  UserMap,
  CreateUserMapData,
  UpdateUserMapData,
  UserMapFilters,
  UserMapListResponse,
  MapAccessCheck,
  MapPermission,
} from '../types';

/**
 * Helper to get current user's account ID
 */
async function getCurrentAccountId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated');
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error || !account) {
    throw new Error('Account not found. Please complete your profile setup.');
  }

  return account.id;
}

/**
 * Service for user map operations
 */
export class UserMapService {
  /**
   * Create a new user map
   * Requires authentication and account setup
   */
  static async createMap(data: CreateUserMapData): Promise<UserMap> {
    const accountId = await getCurrentAccountId();

    const { data: map, error } = await supabase
      .from('maps')
      .insert({
        title: data.title,
        description: data.description ?? null,
        account_id: accountId,
      })
      .select()
      .single();

    if (error) {
      console.error('[UserMapService] Error creating map:', error);
      throw new Error(`Failed to create map: ${error.message}`);
    }

    return map as UserMap;
  }

  /**
   * Get a single map by ID
   * Returns null if map doesn't exist or user doesn't have access
   */
  static async getMapById(mapId: string): Promise<UserMap | null> {
    const { data: map, error } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[UserMapService] Error fetching map:', error);
      throw new Error(`Failed to fetch map: ${error.message}`);
    }

    return map as UserMap;
  }

  /**
   * Get all maps accessible to the current user
   * Includes owned maps and maps shared with the user
   */
  static async getMaps(filters?: UserMapFilters): Promise<UserMap[]> {
    const accountId = await getCurrentAccountId();

    // Get maps where user is owner
    const { data: ownedMaps, error: ownedError } = await supabase
      .from('maps')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (ownedError) {
      console.error('[UserMapService] Error fetching owned maps:', ownedError);
      throw new Error(`Failed to fetch maps: ${ownedError.message}`);
    }

    // Get map IDs that are shared with user
    const { data: sharedMapIds, error: sharedIdsError } = await supabase
      .from('map_shares')
      .select('map_id')
      .eq('account_id', accountId);

    if (sharedIdsError) {
      console.error('[UserMapService] Error fetching shared map IDs:', sharedIdsError);
      throw new Error(`Failed to fetch shared maps: ${sharedIdsError.message}`);
    }

    // Get the actual maps for shared map IDs
    let sharedMaps: UserMap[] = [];
    if (sharedMapIds && sharedMapIds.length > 0) {
      const mapIds = sharedMapIds.map(share => share.map_id);
      const { data: sharedMapsData, error: sharedMapsError } = await supabase
        .from('maps')
        .select('*')
        .in('id', mapIds)
        .order('created_at', { ascending: false });

      if (sharedMapsError) {
        console.error('[UserMapService] Error fetching shared maps:', sharedMapsError);
        throw new Error(`Failed to fetch shared maps: ${sharedMapsError.message}`);
      }

      sharedMaps = (sharedMapsData || []) as UserMap[];
    }

    // Combine and remove duplicates by id
    const owned = (ownedMaps || []) as UserMap[];
    const allMaps = [...owned, ...sharedMaps];
    const uniqueMaps = Array.from(
      new Map(allMaps.map(map => [map.id, map])).values()
    );

    // Apply filters if provided
    let filteredMaps = uniqueMaps;
    if (filters) {
      if (filters.account_id) {
        filteredMaps = filteredMaps.filter(map => map.account_id === filters.account_id);
      }
      if (filters.map_id) {
        filteredMaps = filteredMaps.filter(map => map.id === filters.map_id);
      }
    }

    return filteredMaps.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Get maps with metadata (point count, share count, etc.)
   */
  static async getMapsWithMetadata(filters?: UserMapFilters): Promise<UserMapListResponse> {
    const maps = await this.getMaps(filters);
    const accountId = await getCurrentAccountId();

    // Get point counts for each map
    const mapIds = maps.map(map => map.id);
    const { data: pointCounts } = await supabase
      .from('points')
      .select('map_id')
      .in('map_id', mapIds);

    // Get share counts for each map
    const { data: shareCounts } = await supabase
      .from('map_shares')
      .select('map_id')
      .in('map_id', mapIds);

    // Build metadata
    const mapsWithMetadata = maps.map(map => {
      const pointCount = pointCounts?.filter(p => p.map_id === map.id).length || 0;
      const shareCount = shareCounts?.filter(s => s.map_id === map.id).length || 0;
      const isOwner = map.account_id === accountId;

      return {
        ...map,
        point_count: pointCount,
        share_count: shareCount,
        is_owner: isOwner,
        user_permission: isOwner ? ('edit' as MapPermission) : null,
      };
    });

    const ownedCount = mapsWithMetadata.filter(m => m.is_owner).length;
    const sharedCount = mapsWithMetadata.filter(m => !m.is_owner).length;

    return {
      maps: mapsWithMetadata,
      total: mapsWithMetadata.length,
      owned_count: ownedCount,
      shared_count: sharedCount,
    };
  }

  /**
   * Update an existing map
   * Requires user to be the owner
   */
  static async updateMap(mapId: string, data: UpdateUserMapData): Promise<UserMap> {
    const accountId = await getCurrentAccountId();

    // Verify ownership
    const map = await this.getMapById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    if (map.account_id !== accountId) {
      throw new Error('You do not have permission to update this map');
    }

    const updateData: Partial<UpdateUserMapData> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;

    const { data: updatedMap, error } = await supabase
      .from('maps')
      .update(updateData)
      .eq('id', mapId)
      .select()
      .single();

    if (error) {
      console.error('[UserMapService] Error updating map:', error);
      throw new Error(`Failed to update map: ${error.message}`);
    }

    return updatedMap as UserMap;
  }

  /**
   * Delete a map
   * Requires user to be the owner
   * Cascades to delete all points and shares
   */
  static async deleteMap(mapId: string): Promise<void> {
    const accountId = await getCurrentAccountId();

    // Verify ownership
    const map = await this.getMapById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    if (map.account_id !== accountId) {
      throw new Error('You do not have permission to delete this map');
    }

    const { error } = await supabase
      .from('maps')
      .delete()
      .eq('id', mapId);

    if (error) {
      console.error('[UserMapService] Error deleting map:', error);
      throw new Error(`Failed to delete map: ${error.message}`);
    }
  }

  /**
   * Check if current user has access to a map
   * Returns access information including permission level
   */
  static async checkMapAccess(mapId: string): Promise<MapAccessCheck> {
    const accountId = await getCurrentAccountId();

    const map = await this.getMapById(mapId);
    if (!map) {
      return {
        has_access: false,
        is_owner: false,
        permission: null,
      };
    }

    // Check if user is owner
    if (map.account_id === accountId) {
      return {
        has_access: true,
        is_owner: true,
        permission: 'edit',
      };
    }

    // Check if map is shared with user
    const { data: share, error } = await supabase
      .from('map_shares')
      .select('permission')
      .eq('map_id', mapId)
      .eq('account_id', accountId)
      .single();

    if (error || !share) {
      return {
        has_access: false,
        is_owner: false,
        permission: null,
      };
    }

    return {
      has_access: true,
      is_owner: false,
      permission: share.permission as MapPermission,
    };
  }

  /**
   * Check if current user can edit a map
   */
  static async canEditMap(mapId: string): Promise<boolean> {
    const access = await this.checkMapAccess(mapId);
    return access.has_access && (access.is_owner || access.permission === 'edit');
  }

  /**
   * Check if current user can view a map
   */
  static async canViewMap(mapId: string): Promise<boolean> {
    const access = await this.checkMapAccess(mapId);
    return access.has_access;
  }
}







