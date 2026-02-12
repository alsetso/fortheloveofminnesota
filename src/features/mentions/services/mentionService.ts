import { supabase } from '@/lib/supabase';
import { AccountService } from '@/features/auth/services/memberService';
import type { Mention, CreateMentionData, MentionFilters, MentionGeoJSONCollection, MentionGeoJSONFeature } from '@/types/mention';

/**
 * Service for managing mentions
 * Note: Mentions are now stored in map_pins table, linked to the "live" map
 */
export class MentionService {
  /**
   * Get the live map ID (cached)
   */
  private static liveMapIdCache: string | null = null;
  
  private static async getLiveMapId(): Promise<string> {
    if (this.liveMapIdCache) {
      return this.liveMapIdCache;
    }
    
    const { data, error } = await supabase
      .schema('maps')
      .from('maps')
      .select('id')
      .eq('slug', 'live')
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      throw new Error('Live map not found');
    }
    
    this.liveMapIdCache = data.id;
    return data.id;
  }
  /**
   * Fetch all public mentions
   * Optionally filter by account_id, year, or bounding box
   * Includes account information (username, image_url) when available
   */
  static async getMentions(filters?: MentionFilters): Promise<Mention[]> {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;
    
    // Build query - optimized for map display
    // Select only essential columns (exclude large JSONB fields like map_meta, atlas_meta for performance)
    // Note: maps.pins uses geometry (PostGIS) instead of lat/lng, author_account_id instead of account_id,
    // body instead of description, tag_id instead of mention_type_id
    // PostgREST cannot join across schemas, so we fetch account data separately
    const essentialColumns = `id,
      geometry,
      body,
      image_url,
      video_url,
      media_type,
      author_account_id,
      tag_id,
      visibility,
      archived,
      post_date,
      created_at,
      updated_at,
      view_count`;
    
    let query = supabase
      .schema('maps')
      .from('pins')
      .select(`${essentialColumns},
        mention_type:tags(
          id,
          emoji,
          name
        )`)
      .eq('archived', false) // Exclude archived mentions
      .eq('is_active', true); // Exclude inactive pins
    
    // For anonymous users, explicitly filter to public mentions only
    // (RLS should handle this, but explicit filter ensures it works)
    if (!isAuthenticated) {
      query = query.eq('visibility', 'public');
    }
    
    // Visibility filter - if explicitly requested, apply it
    // This allows search results to show only public mentions even for authenticated users
    if (filters?.visibility) {
      query = query.eq('visibility', filters.visibility);
    }
    
    query = query.order('created_at', { ascending: false });

    if (filters?.account_id) {
      query = query.eq('author_account_id', filters.account_id);
    }

    // Note: maps.pins doesn't have city_id column, so this filter is ignored
    // if (filters?.city_id) {
    //   query = query.eq('city_id', filters.city_id);
    // }

    // All mentions are now linked to the live map
    // If map_id filter is provided, use it; otherwise default to live map
    if (filters?.map_id) {
      query = query.eq('map_id', filters.map_id);
    } else {
      // Default to live map for mentions
      const liveMapId = await this.getLiveMapId();
      query = query.eq('map_id', liveMapId);
    }

    if (filters?.mention_type_ids && filters.mention_type_ids.length > 0) {
      // Multiple mention types - use 'in' filter
      query = query.in('tag_id', filters.mention_type_ids);
    } else if (filters?.mention_type_id) {
      // Single mention type
      query = query.eq('tag_id', filters.mention_type_id);
    }

    // Time filter - filter by created_at (last 24 hours or 7 days)
    // 'all' means no time filter is applied
    if (filters?.timeFilter && filters.timeFilter !== 'all') {
      const now = new Date();
      let cutoffDate: Date;
      
      if (filters.timeFilter === '24h') {
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (filters.timeFilter === '7d') {
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoffDate = now; // Fallback (shouldn't happen)
      }
      
      const cutoffISO = cutoffDate.toISOString();
      query = query.gte('created_at', cutoffISO);
    }

    // Add reasonable limit for performance (5000 mentions max)
    // This prevents loading thousands of mentions on initial load
    // Users can use filters (time, year, bbox) to narrow results further
    query = query.limit(5000);

    // Year filter - filter by post_date year (or created_at if post_date is null)
    // Using 01-02 instead of 01-01 to avoid timezone issues
    // Note: Year filter and time filter are mutually exclusive - time filter takes precedence
    if (filters?.year && !filters?.timeFilter) {
      const yearStart = `${filters.year}-01-02T00:00:00.000Z`;
      const yearEnd = `${filters.year + 1}-01-02T00:00:00.000Z`;
      
      // Filter mentions where post_date is in the year range
      // OR where post_date is null and created_at is in the year range
      query = query.or(
        `and(post_date.gte.${yearStart},post_date.lt.${yearEnd}),and(post_date.is.null,created_at.gte.${yearStart},created_at.lt.${yearEnd})`
      );
    }

    // Bounding box filter for map queries
    // Note: PostgREST doesn't support PostGIS ST_Within/ST_Intersects in filters easily
    // For now, we'll filter client-side after extracting lat/lng from geometry
    // TODO: Consider using PostGIS RPC function for server-side bbox filtering
    // if (filters?.bbox) {
    //   // Would need PostGIS function: ST_Within(geometry, ST_MakeEnvelope(...))
    // }

    let data, error;
    try {
      const result = await query;
      data = result.data;
      error = result.error;
    } catch (fetchError) {
      // Handle network errors (e.g., "Failed to fetch")
      console.error('[MentionService] Network error fetching mentions:', fetchError);
      // Check if it's a network error vs Supabase error
      if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      throw fetchError;
    }

    if (error) {
      console.error('[MentionService] Error fetching mentions:', error);
      throw new Error(`Failed to fetch mentions: ${error.message}`);
    }

    const pins = (data || []) as any[];

    // Extract lat/lng from PostGIS geometry and transform to Mention format
    // Also fetch account data separately (PostgREST can't join across schemas)
    const accountIds = [...new Set(pins.map((p: any) => p.author_account_id).filter(Boolean))];
    const accountMap = new Map<string, any>();
    
    if (accountIds.length > 0) {
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, username, first_name, image_url, plan')
        .in('id', accountIds);
      
      if (!accountsError && accounts) {
        accounts.forEach((account: any) => {
          accountMap.set(account.id, account);
        });
      }
    }

    // Transform pins to mentions format
    const mentions = pins.map((pin: any) => {
      // Extract lat/lng from PostGIS geometry
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (pin.geometry) {
        try {
          // Try parsing as GeoJSON first
          const geom = typeof pin.geometry === 'string' ? JSON.parse(pin.geometry) : pin.geometry;
          if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
            lng = geom.coordinates[0];
            lat = geom.coordinates[1];
          } else if (typeof pin.geometry === 'string') {
            // Try parsing PostGIS POINT string format: "POINT(lng lat)"
            const match = pin.geometry.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }
        } catch (e) {
          console.warn('[MentionService] Failed to parse geometry:', e);
        }
      }

      // Transform mention_type relationship
      let mentionType = null;
      if (pin.mention_type) {
        if (Array.isArray(pin.mention_type)) {
          mentionType = pin.mention_type.length > 0 ? pin.mention_type[0] : null;
        } else {
          mentionType = pin.mention_type;
        }
      }

      // Get account data
      const account = pin.author_account_id ? accountMap.get(pin.author_account_id) : null;

      return {
        ...pin,
        lat,
        lng,
        description: pin.body || null,
        account_id: pin.author_account_id || null,
        mention_type_id: pin.tag_id || null,
        mention_type: mentionType,
        account: account ? {
          id: account.id,
          username: account.username,
          first_name: account.first_name,
          image_url: account.image_url,
          plan: account.plan,
        } : null,
        // Legacy fields that maps.pins doesn't have
        city_id: null,
        collection_id: null,
        is_active: true,
      };
    });

    // Apply bbox filter client-side if needed (since PostgREST can't filter PostGIS geometry easily)
    let filteredMentions = mentions;
    if (filters?.bbox) {
      filteredMentions = mentions.filter((mention: any) => {
        if (mention.lat === null || mention.lng === null) return false;
        return mention.lat >= filters.bbox!.minLat &&
               mention.lat <= filters.bbox!.maxLat &&
               mention.lng >= filters.bbox!.minLng &&
               mention.lng <= filters.bbox!.maxLng;
      });
    }

    // Add likes data if we have mentions
    return filteredMentions as Mention[];
  }

  /**
   * Create a new mention
   * Requires authenticated user
   */
  static async createMention(data: CreateMentionData, accountId?: string): Promise<Mention> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create mentions');
    }

    // Use provided accountId or get from authenticated user
    let account_id: string;
    if (accountId) {
      // Verify user owns this account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found or you do not have access to it.');
      }
      account_id = account.id;
    } else {
      // Fallback to first account (for backward compatibility)
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found. Please complete your profile setup.');
      }
      account_id = account.id;
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

    // Use city_id if provided, otherwise leave as null
    const cityId = data.city_id || null;

    // Get map ID - use provided map_id or default to live map
    const mapId = data.map_id || await this.getLiveMapId();
    
    // Use RPC function to insert into maps.pins
    const { data: pinResult, error } = await supabase.rpc('insert_pin_to_maps_pins', {
      p_map_id: mapId,
      p_author_account_id: account_id,
      p_lat: data.lat,
      p_lng: data.lng,
      p_body: data.description || '',
      p_title: null,
      p_emoji: null,
      p_caption: null,
      p_image_url: data.image_url || null,
      p_video_url: data.video_url || null,
      p_icon_url: null,
      p_media_type: data.media_type || 'none',
      p_full_address: data.full_address || null,
      p_map_meta: data.map_meta || null,
      p_atlas_meta: null,
      p_tag_id: data.mention_type_id || null,
      p_visibility: data.visibility || 'public',
      p_post_date: normalizedPostDate,
      p_tagged_account_ids: data.tagged_account_ids && data.tagged_account_ids.length > 0 
        ? data.tagged_account_ids as any
        : [],
    });

    if (error) {
      console.error('[MentionService] Error creating mention:', error);
      throw new Error(`Failed to create mention: ${error.message}`);
    }

    if (!pinResult || pinResult.length === 0) {
      throw new Error('Failed to create mention: No data returned');
    }

    const pin = pinResult[0];
    
    // Transform maps.pins format to Mention format
    // Fetch account and mention_type data
    const { data: accountData } = await supabase
      .from('accounts')
      .select('id, username, first_name, image_url')
      .eq('id', account_id)
      .single();
    
    let mentionTypeData = null;
    if (pin.tag_id) {
      const { data: tagData } = await supabase
        .schema('maps')
        .from('tags')
        .select('id, emoji, name')
        .eq('id', pin.tag_id)
        .single();
      mentionTypeData = tagData;
    }

    // Transform to Mention format
    const mention: Mention = {
      id: pin.id,
      map_id: pin.map_id,
      lat: data.lat, // Keep original lat/lng for compatibility
      lng: data.lng,
      description: pin.body,
      caption: pin.caption,
      emoji: pin.emoji,
      image_url: pin.image_url,
      video_url: pin.video_url,
      media_type: pin.media_type as 'image' | 'video' | 'none',
      account_id: pin.author_account_id,
      mention_type_id: pin.tag_id,
      visibility: pin.visibility as 'public' | 'private',
      archived: pin.archived,
      post_date: pin.post_date,
      created_at: pin.created_at,
      updated_at: pin.updated_at,
      view_count: pin.view_count,
      full_address: pin.full_address,
      map_meta: pin.map_meta,
      atlas_meta: pin.atlas_meta,
      tagged_account_ids: Array.isArray(pin.tagged_account_ids) 
        ? pin.tagged_account_ids 
        : (typeof pin.tagged_account_ids === 'string' 
          ? JSON.parse(pin.tagged_account_ids) 
          : []),
      account: accountData ? {
        id: accountData.id,
        username: accountData.username,
        first_name: accountData.first_name,
        image_url: accountData.image_url,
      } : null,
      mention_type: mentionTypeData ? {
        id: mentionTypeData.id,
        emoji: mentionTypeData.emoji,
        name: mentionTypeData.name,
      } : null,
      collection_id: null, // maps.pins doesn't have collection_id
      city_id: null, // maps.pins doesn't have city_id
      is_active: true, // maps.pins doesn't have is_active, assume true
    };

    return mention;
  }

  /**
   * Update an existing mention
   * User must own the mention
   */
  static async updateMention(
    mentionId: string, 
    data: { 
      description?: string | null; 
      archived?: boolean; 
      collection_id?: string | null;
      image_url?: string | null;
      video_url?: string | null;
      media_type?: 'image' | 'video' | 'none';
    }
  ): Promise<Mention> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update mentions');
    }

    // Transform data to maps.pins schema
    const updateData: any = {};
    if (data.description !== undefined) updateData.body = data.description;
    if (data.archived !== undefined) updateData.archived = data.archived;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.video_url !== undefined) updateData.video_url = data.video_url;
    if (data.media_type !== undefined) updateData.media_type = data.media_type;
    // Note: collection_id doesn't exist in maps.pins, so it's ignored

    const { data: mention, error } = await supabase
      .schema('maps')
      .from('pins')
      .update(updateData)
      .eq('id', mentionId)
      .eq('is_active', true)
      .select()
      .single();

    if (error) {
      console.error('[MentionService] Error updating mention:', error);
      throw new Error(`Failed to update mention: ${error.message}`);
    }

    // Transform back to Mention format
    const transformedMention = {
      ...mention,
      description: mention.body || null,
      account_id: mention.author_account_id || null,
      mention_type_id: mention.tag_id || null,
      city_id: null,
      collection_id: null,
    };

    return transformedMention as Mention;
  }

  /**
   * Delete a mention
   * User must own the mention
   */
  static async deleteMention(mentionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to delete mentions');
    }

    // Get mention to verify ownership
    // PostgREST can't join across schemas, so fetch pin and account separately
    const { data: pin, error: pinError } = await supabase
      .schema('maps')
      .from('pins')
      .select('author_account_id')
      .eq('id', mentionId)
      .eq('is_active', true)
      .single();

    if (pinError || !pin) {
      throw new Error('Mention not found');
    }

    // Verify user owns the account that created this pin
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, user_id')
      .eq('id', pin.author_account_id)
      .single();

    if (accountError || !account || account.user_id !== user.id) {
      throw new Error('You do not have permission to delete this mention');
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .schema('maps')
      .from('pins')
      .update({ is_active: false, archived: true })
      .eq('id', mentionId);

    if (error) {
      console.error('[MentionService] Error deleting mention:', error);
      throw new Error(`Failed to delete mention: ${error.message}`);
    }
  }

  /**
   * Convert mentions array to GeoJSON FeatureCollection
   * Includes description and account_image_url for all users
   */
  static mentionsToGeoJSON(mentions: Mention[]): MentionGeoJSONCollection {
    const features: MentionGeoJSONFeature[] = mentions.map((mention) => {
      const properties: any = {
        id: mention.id,
        account_id: mention.account_id,
        collection_emoji: (mention as any).collections?.emoji || null,
        account_image_url: (mention as any).accounts?.image_url || null,
        account_plan: (mention as any).accounts?.plan || null, // Include plan for gold border on map pins
        account_username: mention.account?.username || (mention as any).accounts?.username || null, // Include username for fast click reporting
      };
      
      // Include description if it exists
      if (mention.description !== null && mention.description !== undefined) {
        properties.description = mention.description;
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [mention.lng, mention.lat],
        },
        properties,
      } as MentionGeoJSONFeature;
    });

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}

