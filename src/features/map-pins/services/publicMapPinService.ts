import { supabase } from '@/lib/supabase';
import type { MapPin, CreateMapPinData, UpdateMapPinData, MapPinFilters, MapPinGeoJSONCollection, MapPinGeoJSONFeature } from '@/types/map-pin';
import { MAP_CONFIG } from '@/features/map/config';
import { AddressParser } from '@/features/map/services/addressParser';
import { minnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';

/**
 * Normalize historical event dates to January 1st when the date is before 2025.
 * This ensures consistency for historical dates where only the year is typically known,
 * while preserving full date precision for recent events.
 * 
 * @param dateString - ISO date string (YYYY-MM-DD format)
 * @returns Normalized ISO date string (YYYY-MM-DD format)
 */
function normalizeEventDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const cutoffYear = 2025;
  
  // If date is before 2025, normalize to January 1st of that year
  if (year < cutoffYear) {
    return `${year}-01-01T00:00:00.000Z`;
  }
  
  // For 2025 and later, return the date as-is (preserve full precision)
  return date.toISOString();
}

/**
 * Service for managing public map pins
 * Requires authenticated users
 */
export class PublicMapPinService {
  /**
   * Get pin count for an account
   */
  static async getPinCount(accountId: string): Promise<number> {
    const { count, error } = await supabase
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if (error) {
      console.error('[PublicMapPinService] Error getting pin count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Get total pin count with optional filters (for year filtering)
   */
  static async getPinCountWithFilters(filters?: MapPinFilters): Promise<number> {
    let query = supabase
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('archived', false); // Exclude archived pins

    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    // Year filter - filter by event_date year (or created_at if event_date is null)
    if (filters?.year) {
      const yearStart = `${filters.year}-01-01T00:00:00.000Z`;
      const yearEnd = `${filters.year + 1}-01-01T00:00:00.000Z`;
      
      // Filter pins where event_date is in the year range
      // OR where event_date is null and created_at is in the year range
      query = query.or(
        `and(event_date.gte.${yearStart},event_date.lt.${yearEnd}),and(event_date.is.null,created_at.gte.${yearStart},created_at.lt.${yearEnd})`
      );
    }

    // Bounding box filter for map queries
    if (filters?.bbox) {
      query = query
        .gte('lat', filters.bbox.minLat)
        .lte('lat', filters.bbox.maxLat)
        .gte('lng', filters.bbox.minLng)
        .lte('lng', filters.bbox.maxLng);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[PublicMapPinService] Error getting pin count:', error);
      return 0;
    }

    return count || 0;
  }
  /**
   * Fetch all public map pins
   * Optionally filter by type, account_id, or bounding box
   * Includes account information (username, image_url) when available
   * Now works for both authenticated and anonymous users (RLS allows viewing accounts with public pins)
   */
  static async getPins(filters?: MapPinFilters): Promise<MapPin[]> {
    // Pure RLS approach: Let Supabase handle the join and RLS filtering
    // RLS policies ensure:
    // - Authenticated users: Can see all accounts (migration 144)
    // - Anonymous users: Can see accounts with public pins (migrations 217, 258)
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
      .eq('archived', false) // Exclude archived pins
      .order('created_at', { ascending: false });

    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    // Year filter - filter by event_date year (or created_at if event_date is null)
    if (filters?.year) {
      const yearStart = `${filters.year}-01-01T00:00:00.000Z`;
      const yearEnd = `${filters.year + 1}-01-01T00:00:00.000Z`;
      
      // Filter pins where event_date is in the year range
      // OR where event_date is null and created_at is in the year range
      // Supabase doesn't support COALESCE in filters, so we use OR with two conditions
      query = query.or(
        `and(event_date.gte.${yearStart},event_date.lt.${yearEnd}),and(event_date.is.null,created_at.gte.${yearStart},created_at.lt.${yearEnd})`
      );
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
    // RLS ensures accounts are only returned if user has permission to view them
    return (data || []).map((pin: any) => {
      // Handle accounts join - Supabase returns as nested object or array
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
          username: account.username || account.first_name || 'User',
          image_url: account.image_url,
        } : null,
        // Remove the raw accounts field (Supabase returns it as nested)
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
   * Requires authenticated user
   * Validates that the pin location is within Minnesota
   */
  static async createPin(data: CreateMapPinData): Promise<MapPin> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create pins');
    }

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

    // Get account_id from authenticated user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found. Please complete your profile setup.');
    }

    // Validate hide_location requires city_id
    if (data.hide_location && !data.city_id) {
      throw new Error('City ID is required when hiding location');
    }

    // If hide_location is true, ensure we use city coordinates
    // (coordinates should already be city coordinates from the client, but validate)
    if (data.hide_location && data.city_id) {
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('lat, lng')
        .eq('id', data.city_id)
        .single();
      
      if (!cityError && cityData && cityData.lat && cityData.lng) {
        // Override coordinates with city coordinates
        data.lat = Number(cityData.lat);
        data.lng = Number(cityData.lng);
      } else {
        throw new Error('City coordinates not found. Cannot hide location without city coordinates.');
      }
    }

    // Validate and normalize event_date if provided (max 100 years in the past)
    let normalizedEventDate: string | null = null;
    if (data.event_date) {
      const eventDate = new Date(data.event_date);
      const now = new Date();
      const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      
      if (eventDate > now) {
        throw new Error('Event date cannot be in the future');
      }
      
      if (eventDate < hundredYearsAgo) {
        throw new Error('Event date cannot be more than 100 years in the past');
      }
      
      // Normalize historical dates (before 2025) to January 1st
      normalizedEventDate = normalizeEventDate(data.event_date);
    }

    const { data: pin, error } = await supabase
      .from('pins')
      .insert({
        ...data,
        event_date: normalizedEventDate,
        account_id: account.id,
        visibility: data.visibility || 'public',
        archived: false, // New pins are never archived
        // If event_date not provided, it will default to created_at in the database
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

    // Normalize event_date if being updated
    const updateData = { ...data };
    if (updateData.event_date !== undefined) {
      if (updateData.event_date) {
        const eventDate = new Date(updateData.event_date);
        const now = new Date();
        const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
        
        if (eventDate > now) {
          throw new Error('Event date cannot be in the future');
        }
        
        if (eventDate < hundredYearsAgo) {
          throw new Error('Event date cannot be more than 100 years in the past');
        }
        
        // Normalize historical dates (before 2025) to January 1st
        updateData.event_date = normalizeEventDate(updateData.event_date) as any;
      } else {
        // If explicitly set to null, allow it
        updateData.event_date = null as any;
      }
    }

    // Update the pin
    // The WHERE clauses ensure:
    // 1. Pin ID matches
    // 2. User owns the pin (account_id matches)
    // 3. Pin is not archived (archived = false)
    const { data: pin, error } = await supabase
      .from('pins')
      .update(updateData)
      .eq('id', pinId)
      .eq('account_id', account.id)
      .eq('archived', false)
      .select()
      .single();

    if (error) {
      console.error('Error updating map pin:', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        pinId,
        accountId: account.id,
        updateData,
      });
      throw new Error(`Failed to update pin: ${error.message || 'Unknown error'}`);
    }

    // Check if any rows were actually updated
    // If no pin returned, either:
    // 1. Pin doesn't exist
    // 2. User doesn't own the pin
    // 3. Pin is archived
    if (!pin) {
      throw new Error('Pin not found, is archived, or you do not have permission to update it');
    }

    return pin as MapPin;
  }

  /**
   * Delete a map pin (soft delete - marks as archived)
   * User must own the pin
   * 
   * Archiving logic:
   * - Sets the `archived` column (BOOLEAN) to `true`
   * - Only updates pins where `archived = false` (not already archived)
   * - Requires ownership via `account_id` match
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

    // Archive the pin: set archived = true
    // RLS policy will enforce ownership - we don't need to check account_id in WHERE
    // The WHERE clauses ensure:
    // 1. Pin ID matches
    // 2. Pin is not already archived (archived = false)
    // RLS policy "Users can update own pins" will ensure user owns the pin
    const { data, error } = await supabase
      .from('pins')
      .update({ archived: true })
      .eq('id', pinId)
      .eq('archived', false)
      .select('id');

    // Check for error first
    if (error) {
      // Extract error message - handle different error object structures
      let errorMessage = 'Unknown error';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else {
        // Try to stringify the error to see what we have
        try {
          const errorStr = JSON.stringify(error, Object.getOwnPropertyNames(error));
          if (errorStr && errorStr !== '{}') {
            errorMessage = errorStr;
          }
        } catch {
          // If stringify fails, try toString
          errorMessage = String(error);
        }
      }
      
      console.error('Error archiving map pin:', {
        error,
        errorMessage,
        errorType: error?.constructor?.name,
        pinId,
        accountId: account.id,
      });
      
      throw new Error(`Failed to archive pin: ${errorMessage}`);
    }

    // Check if any rows were actually updated
    // If no rows updated, either:
    // 1. Pin doesn't exist
    // 2. User doesn't own the pin (RLS blocked it)
    // 3. Pin is already archived
    if (!data || data.length === 0) {
      throw new Error('Pin not found, already archived, or you do not have permission to delete it');
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

