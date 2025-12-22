import { supabase } from '@/lib/supabase';

export interface PointOfInterest {
  id: string;
  name: string | null;
  category: string | null;
  type: string | null;
  location: any; // geography type
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
   */
  static async getPOIs(): Promise<PointOfInterest[]> {
    const { data, error } = await supabase
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
   */
  static async createPOI(poiData: CreatePOIData): Promise<PointOfInterest> {
    const { location, ...rest } = poiData;

    // Convert lat/lng to PostGIS geography point format
    // Supabase expects: `POINT(lng lat)` or `SRID=4326;POINT(lng lat)`
    const locationPoint = `SRID=4326;POINT(${location.lng} ${location.lat})`;

    const { data, error } = await supabase
      .from('points_of_interest')
      .insert({
        ...rest,
        location: locationPoint,
        is_active: true,
        is_verified: false,
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
   * Delete a point of interest (soft delete by setting is_active = false)
   */
  static async deletePOI(poiId: string): Promise<void> {
    const { error } = await supabase
      .from('points_of_interest')
      .update({ is_active: false })
      .eq('id', poiId);

    if (error) {
      console.error('[POIService] Error deleting POI:', error);
      throw error;
    }
  }
}

