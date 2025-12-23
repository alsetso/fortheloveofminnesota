import { supabase } from '@/lib/supabase';
import { LocationLookupService } from '@/features/map/services/locationLookupService';
import type { Mention, CreateMentionData, MentionFilters, MentionGeoJSONCollection, MentionGeoJSONFeature } from '@/types/mention';

/**
 * Service for managing mentions
 */
export class MentionService {
  /**
   * Fetch all public mentions
   * Optionally filter by account_id, year, or bounding box
   * Includes account information (username, image_url) when available
   */
  static async getMentions(filters?: MentionFilters): Promise<Mention[]> {
    const selectQuery = `*,
      accounts(
        id,
        username,
        first_name,
        image_url
      )`;
    
    let query = supabase
      .from('mentions')
      .select(selectQuery)
      .eq('archived', false) // Exclude archived mentions
      .order('created_at', { ascending: false });

    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    if (filters?.city_id) {
      query = query.eq('city_id', filters.city_id);
    }

    // Year filter - filter by post_date year (or created_at if post_date is null)
    // Using 01-02 instead of 01-01 to avoid timezone issues
    if (filters?.year) {
      const yearStart = `${filters.year}-01-02T00:00:00.000Z`;
      const yearEnd = `${filters.year + 1}-01-02T00:00:00.000Z`;
      
      // Filter mentions where post_date is in the year range
      // OR where post_date is null and created_at is in the year range
      query = query.or(
        `and(post_date.gte.${yearStart},post_date.lt.${yearEnd}),and(post_date.is.null,created_at.gte.${yearStart},created_at.lt.${yearEnd})`
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
      console.error('[MentionService] Error fetching mentions:', error);
      throw new Error(`Failed to fetch mentions: ${error.message}`);
    }

    return (data || []) as Mention[];
  }

  /**
   * Create a new mention
   * Requires authenticated user
   */
  static async createMention(data: CreateMentionData): Promise<Mention> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create mentions');
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

    // Validate post_date if provided (max 100 years in the past)
    let normalizedPostDate: string | null = null;
    if (data.post_date) {
      const postDate = new Date(data.post_date);
      const now = new Date();
      const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      
      if (postDate > now) {
        throw new Error('Post date cannot be in the future');
      }
      
      if (postDate < hundredYearsAgo) {
        throw new Error('Post date cannot be more than 100 years in the past');
      }
      
      // Preserve full date timestamp
      normalizedPostDate = postDate.toISOString();
    }

    // Auto-detect city_id if not provided
    let cityId = data.city_id || null;
    if (!cityId) {
      try {
        const locationIds = await LocationLookupService.getLocationIds(data.lat, data.lng);
        cityId = locationIds.cityId || null;
      } catch (error) {
        // Non-blocking: if city detection fails, continue without city_id
        console.warn('[MentionService] Failed to auto-detect city_id:', error);
      }
    }

    const { data: mention, error } = await supabase
      .from('mentions')
      .insert({
        lat: data.lat,
        lng: data.lng,
        description: data.description || null,
        city_id: cityId,
        post_date: normalizedPostDate,
        account_id: account.id,
        visibility: data.visibility || 'public',
        archived: false, // New mentions are never archived
        map_meta: data.map_meta || null,
      })
      .select(`
        *,
        accounts(
          id,
          username,
          first_name,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('[MentionService] Error creating mention:', error);
      throw new Error(`Failed to create mention: ${error.message}`);
    }

    return mention as Mention;
  }

  /**
   * Update an existing mention
   * User must own the mention
   */
  static async updateMention(mentionId: string, data: { description?: string | null; archived?: boolean; collection_id?: string | null }): Promise<Mention> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update mentions');
    }

    const { data: mention, error } = await supabase
      .from('mentions')
      .update(data)
      .eq('id', mentionId)
      .select()
      .single();

    if (error) {
      console.error('[MentionService] Error updating mention:', error);
      throw new Error(`Failed to update mention: ${error.message}`);
    }

    return mention as Mention;
  }

  /**
   * Convert mentions array to GeoJSON FeatureCollection
   */
  static mentionsToGeoJSON(mentions: Mention[]): MentionGeoJSONCollection {
    const features: MentionGeoJSONFeature[] = mentions.map((mention) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [mention.lng, mention.lat],
      },
      properties: {
        id: mention.id,
        description: mention.description,
        account_id: mention.account_id,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}

