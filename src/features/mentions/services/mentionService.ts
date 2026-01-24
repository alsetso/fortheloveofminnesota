import { supabase } from '@/lib/supabase';
import { LikeService } from './likeService';
import { AccountService } from '@/features/auth/services/memberService';
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
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;
    
    // Build query - optimized for map display
    // Select only essential columns (exclude large JSONB fields like map_meta, atlas_meta for performance)
    // Note: collections join is excluded for anonymous users due to RLS restrictions
    const essentialColumns = `id,
      lat,
      lng,
      description,
      image_url,
      video_url,
      media_type,
      account_id,
      city_id,
      collection_id,
      mention_type_id,
      visibility,
      archived,
      post_date,
      created_at,
      updated_at,
      view_count`;
    
    let query = supabase
      .from('mentions')
      .select(isAuthenticated 
        ? `${essentialColumns},
          accounts(
            id,
            username,
            first_name,
            image_url,
            plan
          ),
          collections(
            id,
            emoji,
            title
          ),
          mention_type:mention_types(
            id,
            emoji,
            name
          )`
        : `${essentialColumns},
          accounts(
            image_url
          ),
          mention_type:mention_types(
            id,
            emoji,
            name
          )`
      )
      .eq('archived', false); // Exclude archived mentions
    
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
      query = query.eq('account_id', filters.account_id);
    }

    if (filters?.city_id) {
      query = query.eq('city_id', filters.city_id);
    }

    if (filters?.mention_type_ids && filters.mention_type_ids.length > 0) {
      // Multiple mention types - use 'in' filter
      query = query.in('mention_type_id', filters.mention_type_ids);
    } else if (filters?.mention_type_id) {
      // Single mention type
      query = query.eq('mention_type_id', filters.mention_type_id);
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
    if (filters?.bbox) {
      query = query
        .gte('lat', filters.bbox.minLat)
        .lte('lat', filters.bbox.maxLat)
        .gte('lng', filters.bbox.minLng)
        .lte('lng', filters.bbox.maxLng);
    }

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

    const mentions = (data || []) as any[];

    // Transform mention_type relationship (Supabase returns it as an object when using alias)
    // Since we're using mention_type:mention_types(...), it should already be an object, not an array
    mentions.forEach((mention: any) => {
      // If mention_type is already an object (from the alias), keep it
      // If it's an array (legacy format), transform it
      if (mention.mention_type && Array.isArray(mention.mention_type)) {
        mention.mention_type = mention.mention_type.length > 0 ? mention.mention_type[0] : null;
      } else if (!mention.mention_type) {
        // If mention_type is missing, set it to null
        mention.mention_type = null;
      }
      
      // Clean up any legacy mention_types array if it exists
      if (mention.mention_types) {
        delete mention.mention_types;
      }
      
      // Debug: Log if mention has mention_type_id but no mention_type object
      if (process.env.NODE_ENV === 'development' && mention.mention_type_id && !mention.mention_type) {
        console.warn('[MentionService] Mention has mention_type_id but no mention_type object:', {
          id: mention.id,
          mention_type_id: mention.mention_type_id,
          mention_type: mention.mention_type,
        });
      }
    });

    // Add likes data if we have mentions
    if (mentions.length > 0 && isAuthenticated) {
      try {
        // Get current user's account using AccountService (handles RLS properly)
        const account = await AccountService.getCurrentAccount();
        
        if (account?.id) {
          const mentionIds = mentions.map(m => m.id);
          
          // Get like counts for all mentions (batch query)
          const likeCounts = await LikeService.getLikeCounts(mentionIds);
          
          // Get which mentions the user has liked (batch query)
          const likedMentionIds = await LikeService.getLikedMentionIds(mentionIds, account.id);

          // Merge likes data into mentions
          mentions.forEach(mention => {
            mention.likes_count = likeCounts.get(mention.id) || 0;
            mention.is_liked = likedMentionIds.has(mention.id);
          });
        }
      } catch (likesError) {
        // Non-blocking: if likes fetch fails, mentions still work
        console.warn('[MentionService] Error fetching likes data:', likesError);
        mentions.forEach(mention => {
          mention.likes_count = 0;
          mention.is_liked = false;
        });
      }
    } else if (mentions.length > 0) {
      // For anonymous users, still get like counts (but not is_liked)
      try {
        const mentionIds = mentions.map(m => m.id);
        const likeCounts = await LikeService.getLikeCounts(mentionIds);
        
        mentions.forEach(mention => {
          mention.likes_count = likeCounts.get(mention.id) || 0;
          mention.is_liked = false;
        });
      } catch (likesError) {
        console.warn('[MentionService] Error fetching like counts:', likesError);
        mentions.forEach(mention => {
          mention.likes_count = 0;
          mention.is_liked = false;
        });
      }
    }

    return mentions as Mention[];
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

    const { data: mention, error } = await supabase
      .from('mentions')
      .insert({
        lat: data.lat,
        lng: data.lng,
        description: data.description || null,
        city_id: cityId,
        post_date: normalizedPostDate,
        account_id: account_id,
        visibility: data.visibility || 'public',
        archived: false, // New mentions are never archived
        icon_url: null, // Not used - we use account.image_url instead
        image_url: data.image_url || null,
        video_url: data.video_url || null,
        media_type: data.media_type || 'none',
        full_address: data.full_address || null,
        map_meta: data.map_meta || null,
        atlas_meta: null,
        collection_id: data.collection_id || null,
        mention_type_id: data.mention_type_id || null,
        tagged_account_ids: data.tagged_account_ids && data.tagged_account_ids.length > 0 ? data.tagged_account_ids : [],
      })
      .select(`
        *,
        accounts(
          id,
          username,
          first_name,
          image_url
        ),
        collections(
          id,
          emoji,
          title
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
   * Delete a mention
   * User must own the mention
   */
  static async deleteMention(mentionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to delete mentions');
    }

    // Get mention to verify ownership
    const { data: mention } = await supabase
      .from('mentions')
      .select('account_id, accounts!inner(user_id)')
      .eq('id', mentionId)
      .single();

    const mentionAccounts = mention?.accounts as { user_id: string } | { user_id: string }[] | null | undefined;
    const accountUserId = Array.isArray(mentionAccounts) ? mentionAccounts[0]?.user_id : mentionAccounts?.user_id;

    if (!mention || accountUserId !== user.id) {
      throw new Error('You do not have permission to delete this mention');
    }

    const { error } = await supabase
      .from('mentions')
      .delete()
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

