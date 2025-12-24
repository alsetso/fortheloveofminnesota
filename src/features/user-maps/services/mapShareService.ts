/**
 * Service for managing map shares
 * 
 * Handles sharing maps with other accounts, including:
 * - Creating and updating shares
 * - Listing shares for a map
 * - Removing shares
 * - Checking share permissions
 * 
 * All operations require the user to be the map owner.
 */

import { supabase } from '@/lib/supabase';
import { UserMapService } from './userMapService';
import type {
  MapShare,
  CreateMapShareData,
  UpdateMapShareData,
  MapShareFilters,
  MapShareListResponse,
  MapShareWithAccount,
  MapPermission,
} from '../types';

/**
 * Service for map share operations
 */
export class MapShareService {
  /**
   * Create a new share for a map
   * Requires user to be the map owner
   */
  static async createShare(data: CreateMapShareData): Promise<MapShare> {
    // Verify user is the map owner
    const map = await UserMapService.getMapById(data.map_id);
    if (!map) {
      throw new Error('Map not found');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account || map.account_id !== account.id) {
      throw new Error('You must be the map owner to share it');
    }

    // Prevent sharing with yourself
    if (data.account_id === account.id) {
      throw new Error('Cannot share map with yourself');
    }

    // Check if share already exists
    const { data: existingShare } = await supabase
      .from('map_shares')
      .select('id')
      .eq('map_id', data.map_id)
      .eq('account_id', data.account_id)
      .single();

    if (existingShare) {
      // Update existing share instead
      return this.updateShare(existingShare.id, { permission: data.permission });
    }

    const { data: share, error } = await supabase
      .from('map_shares')
      .insert({
        map_id: data.map_id,
        account_id: data.account_id,
        permission: data.permission,
      })
      .select()
      .single();

    if (error) {
      console.error('[MapShareService] Error creating share:', error);
      throw new Error(`Failed to create share: ${error.message}`);
    }

    return share as MapShare;
  }

  /**
   * Get all shares for a map
   * Requires user to be the map owner
   */
  static async getSharesByMapId(mapId: string): Promise<MapShare[]> {
    // Verify user is the map owner
    const map = await UserMapService.getMapById(mapId);
    if (!map) {
      throw new Error('Map not found');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account || map.account_id !== account.id) {
      throw new Error('You must be the map owner to view shares');
    }

    const { data: shares, error } = await supabase
      .from('map_shares')
      .select('*')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MapShareService] Error fetching shares:', error);
      throw new Error(`Failed to fetch shares: ${error.message}`);
    }

    return (shares || []) as MapShare[];
  }

  /**
   * Get shares with account information
   */
  static async getSharesWithAccounts(mapId: string): Promise<MapShareListResponse> {
    const shares = await this.getSharesByMapId(mapId);

    if (shares.length === 0) {
      return {
        shares: [],
        total: 0,
      };
    }

    // Get account IDs
    const accountIds = shares.map(share => share.account_id);

    // Fetch account information
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, username, display_name')
      .in('id', accountIds);

    if (accountsError) {
      console.error('[MapShareService] Error fetching accounts:', accountsError);
      // Return shares without account info if fetch fails
      return {
        shares: shares.map(share => ({ ...share, account: undefined })),
        total: shares.length,
      };
    }

    // Combine shares with account info
    const sharesWithAccounts: MapShareWithAccount[] = shares.map(share => {
      const account = accounts?.find(acc => acc.id === share.account_id);
      return {
        ...share,
        account: account
          ? {
              id: account.id,
              username: account.username,
              display_name: account.display_name,
            }
          : undefined,
      };
    });

    return {
      shares: sharesWithAccounts,
      total: sharesWithAccounts.length,
    };
  }

  /**
   * Update an existing share
   * Requires user to be the map owner
   */
  static async updateShare(shareId: string, data: UpdateMapShareData): Promise<MapShare> {
    // Get the share to find its map_id
    const { data: share, error: shareError } = await supabase
      .from('map_shares')
      .select('*')
      .eq('id', shareId)
      .single();

    if (shareError || !share) {
      throw new Error('Share not found');
    }

    // Verify user is the map owner
    const map = await UserMapService.getMapById(share.map_id);
    if (!map) {
      throw new Error('Map not found');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account || map.account_id !== account.id) {
      throw new Error('You must be the map owner to update shares');
    }

    const { data: updatedShare, error } = await supabase
      .from('map_shares')
      .update({ permission: data.permission })
      .eq('id', shareId)
      .select()
      .single();

    if (error) {
      console.error('[MapShareService] Error updating share:', error);
      throw new Error(`Failed to update share: ${error.message}`);
    }

    return updatedShare as MapShare;
  }

  /**
   * Delete a share
   * Requires user to be the map owner
   */
  static async deleteShare(shareId: string): Promise<void> {
    // Get the share to find its map_id
    const { data: share, error: shareError } = await supabase
      .from('map_shares')
      .select('*')
      .eq('id', shareId)
      .single();

    if (shareError || !share) {
      throw new Error('Share not found');
    }

    // Verify user is the map owner
    const map = await UserMapService.getMapById(share.map_id);
    if (!map) {
      throw new Error('Map not found');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account || map.account_id !== account.id) {
      throw new Error('You must be the map owner to delete shares');
    }

    const { error } = await supabase
      .from('map_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error('[MapShareService] Error deleting share:', error);
      throw new Error(`Failed to delete share: ${error.message}`);
    }
  }

  /**
   * Get share by map and account ID
   * Useful for checking if a specific account has access
   */
  static async getShareByMapAndAccount(mapId: string, accountId: string): Promise<MapShare | null> {
    const { data: share, error } = await supabase
      .from('map_shares')
      .select('*')
      .eq('map_id', mapId)
      .eq('account_id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[MapShareService] Error fetching share:', error);
      throw new Error(`Failed to fetch share: ${error.message}`);
    }

    return share as MapShare;
  }
}





