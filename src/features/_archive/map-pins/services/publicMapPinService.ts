import { supabase } from '@/lib/supabase';
import type { MapPin, CreateMapPinData, UpdateMapPinData, MapPinFilters, MapPinGeoJSONCollection, MapPinGeoJSONFeature } from '@/types/map-pin';
import { GuestAccountService } from '@/features/auth/services/guestAccountService';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { AddressParser } from '@/features/_archive/map/services/addressParser';
import { minnesotaBoundsService } from '@/features/_archive/map/services/minnesotaBoundsService';

/**
 * Service for managing public map pins
 * Supports both authenticated users and guest accounts
 */
export class PublicMapPinService {
  /**
   * Fetch all public map pins
   * Optionally filter by type, account_id, or bounding box
   * Includes account information (username, image_url) when available
   * Now works for both authenticated and anonymous users (RLS allows viewing accounts with public pins)
   */
  static async getPins(filters?: MapPinFilters): Promise<MapPin[]> {
    // Join accounts for all users (RLS now allows anonymous users to view accounts with public pins)
    const selectQuery = `*,
      accounts(
        id,
        username,
        first_name,
        image_url
      )`;
    
    let query = supabase
      .from('pins')
      .select(selectQuery)
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
      console.error('[PublicMapPinService] Error fetching map pins:', error);
      console.error('[PublicMapPinService] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new Error(`Failed to fetch pins: ${error.message}`);
    }

    // Transform the nested account data to match our interface
    // Handle both array and object formats from Supabase
    return (data || []).map((pin: any) => {
      // Handle accounts join - could be object, array, or null
      let account = null;
      if (pin.accounts) {
        if (Array.isArray(pin.accounts)) {
          account = pin.accounts[0] || null;
        } else {
          account = pin.accounts;
        }
      }
      
      return {
        ...pin,
        visibility: pin.visibility || 'public', // Default to 'public' for backward compatibility
        account: account ? {
          id: account.id,
          username: account.username || account.first_name || 'Guest',
          image_url: account.image_url,
        } : null,
        // Remove the raw accounts field if it exists
        accounts: undefined,
      };
    }) as MapPin[];
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
   * Supports both authenticated users and guest accounts
   * Validates that the pin location is within Minnesota
   */
  static async createPin(data: CreateMapPinData): Promise<MapPin> {
    // Validate location is in Minnesota
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    if (token && token !== 'your_mapbox_token_here') {
      try {
        const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${data.lng},${data.lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address',
          limit: '1',
        });

        const response = await fetch(`${url}?${params}`);
        if (response.ok) {
          const geocodeData = await response.json();
          if (geocodeData.features && geocodeData.features.length > 0) {
            const feature = geocodeData.features[0];
            const parsed = AddressParser.parseMapboxFeature(feature);
            const state = parsed.state;

            if (state && !minnesotaBoundsService.isMinnesotaState(state)) {
              throw new Error('Pins can only be created within Minnesota. This location is outside of Minnesota.');
            }
          }
        }
      } catch (error) {
        // If it's our validation error, re-throw it
        if (error instanceof Error && error.message.includes('Minnesota')) {
          throw error;
        }
        // Otherwise, log but continue (don't block pin creation if geocoding fails)
        console.warn('[PublicMapPinService] Error validating location:', error);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    let accountId: string;

    if (user) {
      // Authenticated user: get account_id from user
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found. Please complete your profile setup.');
      }

      accountId = account.id;
    } else {
      // Guest user: get or create guest account
      const guestAccount = await GuestAccountService.getOrCreateGuestAccount();
      accountId = guestAccount.id;
    }

    const { data: pin, error } = await supabase
      .from('pins')
      .insert({
        ...data,
        account_id: accountId,
        visibility: data.visibility || 'public', // Default to public for guests
      })
      .select()
      .single();

    if (error) {
      console.error('[PublicMapPinService] Error creating map pin:', error);
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
      .channel('map_pins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'map_pins',
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

