/**
 * Service for managing points on user maps
 * 
 * Handles CRUD operations for points on user-created maps.
 * All operations require proper authentication and map access permissions.
 */

import { supabase } from '@/lib/supabase';
import { UserMapService } from './userMapService';
import type {
  UserPoint,
  CreateUserPointData,
  UpdateUserPointData,
  UserPointFilters,
  UserPointListResponse,
  UserPointGeoJSONFeature,
  UserPointGeoJSONCollection,
} from '../types';

/**
 * Service for user point operations
 */
export class UserPointService {
  /**
   * Create a new point on a map
   * Requires user to have edit access to the map
   */
  static async createPoint(data: CreateUserPointData): Promise<UserPoint> {
    // Verify edit access
    const canEdit = await UserMapService.canEditMap(data.map_id);
    if (!canEdit) {
      throw new Error('You do not have permission to add points to this map');
    }

    // Get current account ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found');
    }

    const { data: point, error } = await supabase
      .from('points')
      .insert({
        map_id: data.map_id,
        account_id: account.id,
        lat: data.lat,
        lng: data.lng,
        label: data.label ?? null,
        description: data.description ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[UserPointService] Error creating point:', error);
      throw new Error(`Failed to create point: ${error.message}`);
    }

    return point as UserPoint;
  }

  /**
   * Get a single point by ID
   * Returns null if point doesn't exist or user doesn't have access to the map
   */
  static async getPointById(pointId: string): Promise<UserPoint | null> {
    // First get the point to find its map_id
    const { data: point, error } = await supabase
      .from('points')
      .select('*')
      .eq('id', pointId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[UserPointService] Error fetching point:', error);
      throw new Error(`Failed to fetch point: ${error.message}`);
    }

    // Verify user has access to the map
    const canView = await UserMapService.canViewMap(point.map_id);
    if (!canView) {
      return null; // User doesn't have access
    }

    return point as UserPoint;
  }

  /**
   * Get all points for a map
   * Requires user to have view access to the map
   */
  static async getPointsByMapId(mapId: string, filters?: UserPointFilters): Promise<UserPoint[]> {
    // Verify view access
    const canView = await UserMapService.canViewMap(mapId);
    if (!canView) {
      throw new Error('You do not have permission to view points on this map');
    }

    let query = supabase
      .from('points')
      .select('*')
      .eq('map_id', mapId);

    // Apply filters
    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    // Apply bounding box filter if provided
    if (filters?.bbox) {
      query = query
        .gte('lat', filters.bbox.minLat)
        .lte('lat', filters.bbox.maxLat)
        .gte('lng', filters.bbox.minLng)
        .lte('lng', filters.bbox.maxLng);
    }

    const { data: points, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[UserPointService] Error fetching points:', error);
      throw new Error(`Failed to fetch points: ${error.message}`);
    }

    return (points || []) as UserPoint[];
  }

  /**
   * Get points with metadata
   */
  static async getPointsWithMetadata(mapId: string, filters?: UserPointFilters): Promise<UserPointListResponse> {
    const points = await this.getPointsByMapId(mapId, filters);

    return {
      points,
      total: points.length,
    };
  }

  /**
   * Update an existing point
   * Requires user to have edit access to the map
   */
  static async updatePoint(pointId: string, data: UpdateUserPointData): Promise<UserPoint> {
    // Get the point to find its map_id
    const point = await this.getPointById(pointId);
    if (!point) {
      throw new Error('Point not found or you do not have access');
    }

    // Verify edit access to the map
    const canEdit = await UserMapService.canEditMap(point.map_id);
    if (!canEdit) {
      throw new Error('You do not have permission to update points on this map');
    }

    const updateData: Partial<UpdateUserPointData> = {};
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.description !== undefined) updateData.description = data.description;

    const { data: updatedPoint, error } = await supabase
      .from('points')
      .update(updateData)
      .eq('id', pointId)
      .select()
      .single();

    if (error) {
      console.error('[UserPointService] Error updating point:', error);
      throw new Error(`Failed to update point: ${error.message}`);
    }

    return updatedPoint as UserPoint;
  }

  /**
   * Delete a point
   * Requires user to have edit access to the map
   */
  static async deletePoint(pointId: string): Promise<void> {
    // Get the point to find its map_id
    const point = await this.getPointById(pointId);
    if (!point) {
      throw new Error('Point not found or you do not have access');
    }

    // Verify edit access to the map
    const canEdit = await UserMapService.canEditMap(point.map_id);
    if (!canEdit) {
      throw new Error('You do not have permission to delete points on this map');
    }

    const { error } = await supabase
      .from('points')
      .delete()
      .eq('id', pointId);

    if (error) {
      console.error('[UserPointService] Error deleting point:', error);
      throw new Error(`Failed to delete point: ${error.message}`);
    }
  }

  /**
   * Convert points to GeoJSON FeatureCollection
   */
  static pointsToGeoJSON(points: UserPoint[]): UserPointGeoJSONCollection {
    const features: UserPointGeoJSONFeature[] = points.map(point => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        map_id: point.map_id,
        account_id: point.account_id,
        label: point.label,
        description: point.description,
        created_at: point.created_at,
        updated_at: point.updated_at,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Get points as GeoJSON for a map
   */
  static async getPointsAsGeoJSON(mapId: string, filters?: UserPointFilters): Promise<UserPointGeoJSONCollection> {
    const points = await this.getPointsByMapId(mapId, filters);
    return this.pointsToGeoJSON(points);
  }
}

