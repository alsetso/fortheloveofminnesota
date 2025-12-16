import { supabase } from '@/lib/supabase';

export interface Map {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMapData {
  title: string;
  description?: string;
}

/**
 * Service for managing user maps
 */
export class MapService {
  /**
   * Create a new map
   * Requires authentication and account_id
   */
  static async createMap(data: CreateMapData): Promise<Map> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to create maps');
    }

    // Get account_id from user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found. Please complete your profile setup.');
    }

    const { data: map, error } = await supabase
      .from('maps')
      .insert({
        title: data.title,
        description: data.description || null,
        account_id: account.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating map:', error);
      throw new Error(`Failed to create map: ${error.message}`);
    }

    return map as Map;
  }

  /**
   * Get all maps for the current user (owned or shared)
   */
  static async getMaps(): Promise<Map[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to fetch maps');
    }

    // Get account_id from user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found. Please complete your profile setup.');
    }

    // Get maps where user is owner
    const { data: ownedMaps, error: ownedError } = await supabase
      .from('maps')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false });

    if (ownedError) {
      console.error('Error fetching owned maps:', ownedError);
      throw new Error(`Failed to fetch maps: ${ownedError.message}`);
    }

    // Get map IDs that are shared with user
    const { data: sharedMapIds, error: sharedIdsError } = await supabase
      .from('map_shares')
      .select('map_id')
      .eq('account_id', account.id);

    if (sharedIdsError) {
      console.error('Error fetching shared map IDs:', sharedIdsError);
      throw new Error(`Failed to fetch shared maps: ${sharedIdsError.message}`);
    }

    // Get the actual maps for shared map IDs
    let sharedMaps: Map[] = [];
    if (sharedMapIds && sharedMapIds.length > 0) {
      const mapIds = sharedMapIds.map(share => share.map_id);
      const { data: sharedMapsData, error: sharedMapsError } = await supabase
        .from('maps')
        .select('*')
        .in('id', mapIds)
        .order('created_at', { ascending: false });

      if (sharedMapsError) {
        console.error('Error fetching shared maps:', sharedMapsError);
        throw new Error(`Failed to fetch shared maps: ${sharedMapsError.message}`);
      }

      sharedMaps = (sharedMapsData || []) as Map[];
    }

    // Combine and remove duplicates by id
    const owned = (ownedMaps || []) as Map[];
    const allMaps = [...owned, ...sharedMaps];
    const uniqueMaps = Array.from(
      new Map(allMaps.map(map => [map.id, map])).values()
    );

    return uniqueMaps.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Get a single map by ID (if user has access)
   */
  static async getMapById(mapId: string): Promise<Map | null> {
    const { data: map, error } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching map:', error);
      throw new Error(`Failed to fetch map: ${error.message}`);
    }

    return map as Map;
  }
}

