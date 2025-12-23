import { supabase } from '@/lib/supabase';
import { getPOIEmoji } from '@/features/poi/utils/getPOIEmoji';

export interface PointOfInterest {
  id: string;
  name: string | null;
  category: string | null;
  type: string | null;
  location: any; // geography type
  lat: number | null;
  lng: number | null;
  emoji: string | null;
  description: string | null;
  mapbox_source: string | null;
  mapbox_source_layer: string | null;
  mapbox_layer_id: string | null;
  mapbox_properties: Record<string, any> | null;
  metadata: Record<string, any> | null;
  is_active: boolean;
  is_verified: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePOIData {
  name: string;
  category?: string;
  type?: string;
  location: { lat: number; lng: number };
  emoji?: string;
  description?: string;
  mapbox_source?: string;
  mapbox_source_layer?: string;
  mapbox_layer_id?: string;
  mapbox_properties?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class POIService {
  /**
   * Fetch all active points of interest
   * Location is returned as PostGIS geography (may be WKB hex, text, or GeoJSON)
   * Use parseLocation() utility to extract coordinates
   */
  static async getPOIs(): Promise<PointOfInterest[]> {
    const { data, error } = await supabase
      .schema('map')
      .from('points_of_interest')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[POIService] Error fetching POIs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Create a new point of interest
   * Requires authenticated user
   */
  static async createPOI(poiData: CreatePOIData): Promise<PointOfInterest> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create POIs');
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

    const { location, emoji: providedEmoji, ...rest } = poiData;

    // Calculate emoji based on category/type if not provided
    const emoji = providedEmoji || getPOIEmoji(poiData.category, poiData.type);

    // Convert lat/lng to PostGIS geography point format
    // Supabase expects: `POINT(lng lat)` or `SRID=4326;POINT(lng lat)`
    const locationPoint = `SRID=4326;POINT(${location.lng} ${location.lat})`;

    const { data, error } = await supabase
      .schema('map')
      .from('points_of_interest')
      .insert({
        ...rest,
        location: locationPoint,
        lat: location.lat,
        lng: location.lng,
        emoji,
        is_active: true,
        is_verified: false,
        created_by: user.id, // Set created_by to user ID (references auth.users.id)
      })
      .select()
      .single();

    if (error) {
      console.error('[POIService] Error creating POI:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update a point of interest
   * Requires authenticated user
   */
  static async updatePOI(poiId: string, updates: Partial<CreatePOIData & { lat?: number; lng?: number; emoji?: string }>): Promise<PointOfInterest> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update POIs');
    }

    const updateData: any = { ...updates };

    // If location is provided, update both location geography and lat/lng
    if (updates.location) {
      const locationPoint = `SRID=4326;POINT(${updates.location.lng} ${updates.location.lat})`;
      updateData.location = locationPoint;
      updateData.lat = updates.location.lat;
      updateData.lng = updates.location.lng;
      delete updateData.location; // Remove the object, we've converted it
    }

    // If lat/lng are provided separately, update location geography too
    if (updates.lat !== undefined && updates.lng !== undefined) {
      const locationPoint = `SRID=4326;POINT(${updates.lng} ${updates.lat})`;
      updateData.location = locationPoint;
    }

    // Update emoji if category/type changed
    if (updates.category !== undefined || updates.type !== undefined) {
      const category = updates.category ?? null;
      const type = updates.type ?? null;
      const currentEmoji = updateData.emoji;
      updateData.emoji = currentEmoji || getPOIEmoji(category, type);
    }

    updateData.updated_by = user.id;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .schema('map')
      .from('points_of_interest')
      .update(updateData)
      .eq('id', poiId)
      .select()
      .single();

    if (error) {
      console.error('[POIService] Error updating POI:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a point of interest (soft delete by setting is_active = false)
   */
  static async deletePOI(poiId: string): Promise<void> {
    const { error } = await supabase
      .schema('map')
      .from('points_of_interest')
      .update({ is_active: false })
      .eq('id', poiId);

    if (error) {
      console.error('[POIService] Error deleting POI:', error);
      throw error;
    }
  }
}

