import { supabase } from '@/lib/supabase';
import type { MapPin, CreateMapPinData, UpdateMapPinData, MapPinFilters, MapPinGeoJSONCollection, MapPinGeoJSONFeature } from '@/types/map-pin';

/**
 * Service for managing public map pins
 */
export class PublicMapPinService {
  /**
   * Fetch all public map pins
   * Optionally filter by type, account_id, or bounding box
   * Includes account information (username, image_url) when available
   */
  static async getPins(filters?: MapPinFilters): Promise<MapPin[]> {
    let query = supabase
      .from('pins')
      .select(`
        *,
        accounts!pins_account_id_fkey(
          id,
          username,
          image_url
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    // Bounding box filter for map queries
    if (filters?.bbox) {
      query = query
        .gte('lat', filters.bbox.minLat)
        .lte('lat', filters.bbox.maxLat)
        .gte('lng', filters.bbox.minLng)
        .lte('lng', filters.bbox.maxLng);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching map pins:', error);
      throw new Error(`Failed to fetch pins: ${error.message}`);
    }

    // Transform the nested account data to match our interface
    return (data || []).map((pin: any) => ({
      ...pin,
      account: pin.accounts ? {
        id: pin.accounts.id,
        username: pin.accounts.username,
        image_url: pin.accounts.image_url,
      } : null,
    })) as MapPin[];
  }

  /**
   * Convert map pins to GeoJSON FeatureCollection
   * This is the format Mapbox expects for source data
   */
  static pinsToGeoJSON(pins: MapPin[]): MapPinGeoJSONCollection {
    const features: MapPinGeoJSONFeature[] = pins.map((pin) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.lng, pin.lat], // GeoJSON uses [lng, lat]
      },
      properties: {
        id: pin.id,
        description: pin.description,
        media_url: pin.media_url,
        account_id: pin.account_id,
        city_id: pin.city_id,
        county_id: pin.county_id,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Create a new map pin
   * Requires authentication and account_id
   */
  static async createPin(data: CreateMapPinData): Promise<MapPin> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to create pins');
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

    const { data: pin, error } = await supabase
      .from('pins')
      .insert({
        ...data,
        account_id: account.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating map pin:', error);
      throw new Error(`Failed to create pin: ${error.message}`);
    }

    return pin as MapPin;
  }

  /**
   * Update an existing map pin
   * User must own the pin
   */
  static async updatePin(pinId: string, data: UpdateMapPinData): Promise<MapPin> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to update pins');
    }

    // Verify ownership
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    const { data: pin, error } = await supabase
      .from('pins')
      .update(data)
      .eq('id', pinId)
      .eq('account_id', account.id) // Ensure user owns the pin
      .select()
      .single();

    if (error) {
      console.error('Error updating map pin:', error);
      throw new Error(`Failed to update pin: ${error.message}`);
    }

    if (!pin) {
      throw new Error('Pin not found or you do not have permission to update it');
    }

    return pin as MapPin;
  }

  /**
   * Delete a map pin
   * User must own the pin
   */
  static async deletePin(pinId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to delete pins');
    }

    // Verify ownership
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    const { error } = await supabase
      .from('pins')
      .delete()
      .eq('id', pinId)
      .eq('account_id', account.id); // Ensure user owns the pin

    if (error) {
      console.error('Error deleting map pin:', error);
      throw new Error(`Failed to delete pin: ${error.message}`);
    }
  }

  /**
   * Subscribe to real-time updates for map pins
   * Returns a subscription that can be unsubscribed
   */
  static subscribeToPins(
    callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: MapPin; old?: MapPin }) => void
  ) {
    const channel = supabase
      .channel('pins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pins',
        },
        (payload) => {
          callback({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as MapPin | undefined,
            old: payload.old as MapPin | undefined,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}

