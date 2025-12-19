import { supabase } from '@/lib/supabase';
import { withAuthRetry } from '@/lib/authHelpers';
import type { PinData } from '@/types/pin';

// Tag type (previously from tagService)
export interface Tag {
  id: string;
  slug: string;
  label: string;
  emoji: string | null;
  description: string | null;
  entity_type: string;
  display_order: number;
  is_active: boolean;
  is_public: boolean;
}

export interface PinCategory {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PinMedia {
  type: 'image' | 'video';
  url: string;
  filename: string;
  mime_type?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
  thumbnail_url?: string; // For videos
  order?: number;
  uploaded_at?: string;
}

export interface Pin {
  id: string;
  profile_id: string | null;
  user_id?: string; // Added for backward compatibility
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null; // Renamed from long
  long?: number; // Backward compatibility alias
  visibility: 'public' | 'private' | 'accounts_only';
  status: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  emoji?: string;
  address?: string;
  tag_id: string | null; // Required for user-created pins
  tag?: Tag; // Populated tag object (via join)
  subcategory?: string | null;
  media?: PinMedia[] | null; // Array of media objects (images/videos)
  created_at: string;
  updated_at: string;
}

export interface CreatePinData {
  name: string; // Required
  description?: string | null;
  lat: number;
  lng: number; // Renamed from long
  visibility?: 'public' | 'private' | 'accounts_only';
  emoji?: string;
  address?: string;
  tag_id: string; // Required for user-created pins
  subcategory?: string | null;
  media?: PinMedia[] | null; // Array of media objects (images/videos)
  tags?: string[]; // User-defined labels for organizing pins
}

export interface UpdatePinData {
  name?: string;
  description?: string | null;
  lat?: number;
  lng?: number;
  visibility?: 'public' | 'private' | 'accounts_only';
  status?: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  emoji?: string;
  address?: string;
  tag_id?: string;
  subcategory?: string | null;
  media?: PinMedia[] | null; // Array of media objects (images/videos)
  tags?: string[]; // User-defined labels for organizing pins
}

export interface PinQueryFilters {
  tag_id?: string | string[];
  bbox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  status?: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  profile_id?: string;
}

export class PinCategoryService {
  /**
   * Get all active pin categories
   */
  static async getCategories(): Promise<PinCategory[]> {
    const { data, error } = await supabase
      .from('pins_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching pin categories:', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all public pin categories (for map filters)
   * Optionally filter by profile_type by checking pins table access_list
   */
  static async getPublicCategories(profileType?: string): Promise<PinCategory[]> {
    const { data, error } = await supabase
      .from('pins_categories')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching public pin categories:', error);
      throw new Error(`Failed to fetch public categories: ${error.message}`);
    }

    if (!profileType || !data) {
      return data || [];
    }

    // If profile_type is provided, filter categories based on pins table access_list
    // Get all pins and their access_list to determine which categories are accessible
    const { data: pinsData } = await supabase
      .from('pins')
      .select('slug, category, access_list')
      .eq('status', 'active');

    if (!pinsData) {
      return data || [];
    }

    // Create a map of category -> has accessible pins
    const categoryAccessMap = new Map<string, boolean>();
    
    pinsData.forEach(pin => {
      const category = pin.category;
      const accessList = pin.access_list || [];
      // If access_list is empty, it's accessible to all
      const isAccessible = accessList.length === 0 || accessList.includes(profileType);
      
      if (!categoryAccessMap.has(category)) {
        categoryAccessMap.set(category, false);
      }
      if (isAccessible) {
        categoryAccessMap.set(category, true);
      }
    });

    // Filter categories: only include if at least one pin in that category is accessible
    return data.filter(cat => {
      // Map category slug to pin category enum value
      const categoryMap: Record<string, string> = {
        'project': 'project',
        'listing': 'property',
        'public_concern': 'concern',
      };
      const pinCategory = categoryMap[cat.slug];
      if (!pinCategory) return true; // Unknown category, allow it
      
      const hasAccess = categoryAccessMap.get(pinCategory);
      return hasAccess !== false; // Allow if true or undefined (no pins found)
    });
  }

  /**
   * Get all pin categories (including inactive ones)
   */
  static async getAllCategories(): Promise<PinCategory[]> {
    const { data, error } = await supabase
      .from('pins_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('is_active', { ascending: false }); // Active categories first

    if (error) {
      console.error('Error fetching all pin categories:', error);
      throw new Error(`Failed to fetch all categories: ${error.message}`);
    }

    return data || [];
  }
}

export class PinService {
  /**
   * Get pins with filtering
   * Supports filtering by tag, bounding box, and status
   * Map queries should use this method with bbox parameter
   */
  static async getPins(filters?: PinQueryFilters): Promise<Pin[]> {
    const { data: { user } } = await supabase.auth.getUser();

    // Query pins with tag joined via tag_id
    // Use explicit foreign key reference: tags!pins_tag_id_fkey
    // This ensures Supabase discovers the relationship correctly
    let query = supabase
      .from('pins')
      .select(`
        *,
        tags!pins_tag_id_fkey (
          id,
          slug,
          label,
          emoji,
          description,
          entity_type,
          display_order,
          is_active,
          is_public
        )
      `);

    // Apply tag filter
    if (filters?.tag_id) {
      if (Array.isArray(filters.tag_id)) {
        query = query.in('tag_id', filters.tag_id);
      } else {
        query = query.eq('tag_id', filters.tag_id);
      }
    }

    // Apply bounding box filter (for map queries)
    if (filters?.bbox) {
      query = query
        .gte('lat', filters.bbox.minLat)
        .lte('lat', filters.bbox.maxLat)
        .gte('lng', filters.bbox.minLng)
        .lte('lng', filters.bbox.maxLng);
    }

    // Apply status filter (default to active)
    const status = filters?.status || 'active';
    query = query.eq('status', status);

    // Apply profile_id filter if provided
    if (filters?.profile_id) {
      query = query.eq('profile_id', filters.profile_id);
    }

    // Apply visibility filter based on authentication
    if (user) {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (account) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('account_id', account.id);

        const profileIds = profiles?.map(p => p.id) || [];
        
        if (profileIds.length > 0) {
          const profileIdFilters = profileIds.map(id => `profile_id.eq.${id}`).join(',');
          query = query.or(`visibility.eq.public,visibility.eq.accounts_only,${profileIdFilters}`);
        } else {
          query = query.in('visibility', ['public', 'accounts_only']);
        }
      } else {
        query = query.in('visibility', ['public', 'accounts_only']);
      }
    } else {
      // Anonymous users can only see public pins
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pins:', error);
      throw new Error(`Failed to fetch pins: ${error.message}`);
    }

    // Transform the data to include tag object and backward compatibility
    const transformedPins = (data || []).map((pin: PinData) => {
      // Handle tag join - Supabase may return as object or array
      let tag = null;
      if (pin.tags) {
        // If it's an array (shouldn't happen for one-to-one, but handle it)
        if (Array.isArray(pin.tags)) {
          tag = pin.tags[0] || null;
        } else {
          // It's an object
          tag = pin.tags;
        }
      }
      
      return {
        ...pin,
        tag,
        tags: undefined,
        // Backward compatibility: map lng to long
        long: pin.lng,
      };
    });

    return transformedPins;
  }

  /**
   * Get all public pins and user's own pins (if authenticated)
   * For anonymous users, returns only public pins
   * Optionally filter by tag IDs (server-side filtering) - DEPRECATED, use getPins instead
   * Includes tags via join
   */
  static async getAllPins(tagIds?: string[]): Promise<Pin[]> {
    const { data: { user } } = await supabase.auth.getUser();

    // Query pins with tag joined via tag_id
    // Use explicit foreign key reference: tags!pins_tag_id_fkey
    // This ensures Supabase discovers the relationship correctly
    let query = supabase
      .from('pins')
      .select(`
        *,
        tags!pins_tag_id_fkey (
          id,
          slug,
          label,
          emoji,
          description,
          entity_type,
          display_order,
          is_active,
          is_public
        )
      `);

    // RLS policies handle visibility filtering:
    // - Public pins are visible to everyone
    // - Users can see their own pins (by profile_id) regardless of visibility
    // For authenticated users, we don't filter by visibility - let RLS handle it
    // This ensures all user-owned pins are returned regardless of visibility setting
    if (!user) {
      // Anonymous users can only see public pins
      query = query.eq('visibility', 'public');
    }
    // For authenticated users, no visibility filter - RLS will filter appropriately

    // Only show active pins (exclude draft, archived, hidden, completed)
    query = query.eq('status', 'active');

    // Filter by tag IDs if provided
    // If empty array is passed, return empty result (no tags selected)
    // If undefined, return all pins (no filtering)
    if (tagIds !== undefined) {
      if (tagIds.length === 0) {
        // No tags selected, return empty array
        return [];
      }
      // Filter by tag_id directly
      query = query.in('tag_id', tagIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pins:', error);
      throw new Error(`Failed to fetch pins: ${error.message}`);
    }

    // Transform the data to include tag object and ensure lng/long compatibility
    const transformedPins = (data || []).map((pin: Pin & { tags?: unknown }) => {
      // Handle tag join - Supabase may return as object, array, or null
      let tag = null;
      if (pin.tags) {
        // If it's an array (shouldn't happen for one-to-one, but handle it)
        if (Array.isArray(pin.tags)) {
          tag = pin.tags.length > 0 ? pin.tags[0] : null;
        } else if (typeof pin.tags === 'object') {
          // It's an object - check if it has the expected properties
          if (pin.tags.id || pin.tags.label) {
            tag = pin.tags;
          }
        }
      }
      
      // If tag join failed but we have tag_id, we could fetch it separately
      // but for now we'll just log a warning
      if (!tag && pin.tag_id) {
        console.warn(`Tag join failed for pin ${pin.id} with tag_id ${pin.tag_id}. Join data:`, pin.tags);
      }
      
      return {
        ...pin,
        tag, // Single tag object
        tags: undefined, // Remove the join data
        // Ensure both lng and long are set for backward compatibility
        lng: pin.lng ?? pin.long ?? null,
        long: pin.lng ?? pin.long ?? null, // Backward compatibility alias
      };
    });

    return transformedPins;
  }

  /**
   * Get user's own pins with tags
   */
  static async getUserPins(): Promise<Pin[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user's profile IDs through accounts
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account) {
      return [];
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id);

    const profileIds = profiles?.map(p => p.id) || [];
    
    if (profileIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('pins')
      .select(`
        *,
        tags (
          id,
          slug,
          label,
          emoji,
          description,
          entity_type,
          display_order,
          is_active,
          is_public
        )
      `)
      .in('profile_id', profileIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user pins:', error);
      throw new Error(`Failed to fetch user pins: ${error.message}`);
    }

    // Transform to include tag object and parse media
    return (data || []).map((pin: PinData) => {
      // Parse media if it's a string (JSONB can come as string)
      let media = pin.media;
      if (typeof media === 'string') {
        try {
          media = JSON.parse(media);
        } catch (e) {
          console.warn('Failed to parse media JSON:', e);
          media = null;
        }
      }

      return {
        ...pin,
        tag: pin.tags || null,
        tags: undefined, // Remove the join data
        media: media || null,
      };
    });
  }

  /**
   * Create a new pin
   * Requires name and tag_id
   */
  static async createPin(data: CreatePinData, profileId: string): Promise<Pin> {
    // Validate required fields
    if (!profileId) {
      throw new Error('profile_id is required');
    }
    if (!data.name?.trim()) {
      throw new Error('name is required');
    }
    if (!data.tag_id) {
      throw new Error('tag_id is required');
    }
    if (data.lat == null || data.lng == null) {
      throw new Error('Latitude and longitude are required');
    }

    // Prepare insert data - simple and direct
    const insertData = {
      profile_id: profileId,
      tag_id: data.tag_id,
      name: data.name.trim(),
      lat: data.lat,
      lng: data.lng,
      description: data.description?.trim() || null,
      address: data.address || null,
      emoji: data.emoji || null,
      subcategory: data.subcategory || null,
      visibility: data.visibility || 'public',
      status: 'active' as const,
      media: data.media || null,
      tags: data.tags || [],
    };

    // Create the pin
    const { data: pin, error: pinError } = await supabase
      .from('pins')
      .insert(insertData)
      .select()
      .single();

    if (pinError) {
      console.error('Error creating pin:', pinError);
      console.error('Pin data being inserted:', JSON.stringify(insertData, null, 2));
      throw new Error(`Failed to create pin: ${pinError.message}`);
    }

    if (!pin) {
      throw new Error('Pin was created but no data was returned');
    }

    // Fetch the pin with tag
    const fetchedPin = await this.getPinById(pin.id);
    if (!fetchedPin) {
      throw new Error('Failed to fetch created pin');
    }
    return fetchedPin;
  }

  /**
   * Update a pin
   * Supports updating all pin fields
   */
  static async updatePin(pinId: string, data: UpdatePinData): Promise<Pin> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user's profile IDs
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id);

    const profileIds = profiles?.map(p => p.id) || [];
    
    if (profileIds.length === 0) {
      throw new Error('No profiles found');
    }

    // Build update object
    const updateData: Partial<UpdatePinData> = {};

    // Update fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.tag_id !== undefined) updateData.tag_id = data.tag_id;
    if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
    if (data.media !== undefined) updateData.media = data.media;
    if (data.tags !== undefined) (updateData as Record<string, unknown>).tags = data.tags;

    // Update pin fields
    const { data: pin, error } = await supabase
      .from('pins')
      .update(updateData)
      .eq('id', pinId)
      .in('profile_id', profileIds)
      .select()
      .single();

    if (error) {
      console.error('Error updating pin:', error);
      throw new Error(`Failed to update pin: ${error.message}`);
    }

    if (!pin) {
      throw new Error('Pin not found or access denied');
    }

    // Fetch the updated pin with tag
    const fetchedPin = await this.getPinById(pinId);
    if (!fetchedPin) {
      throw new Error('Failed to fetch updated pin');
    }
    return fetchedPin;
  }

  /**
   * Delete a pin
   */
  static async deletePin(pinId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user's profile IDs
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', account.id);

    const profileIds = profiles?.map(p => p.id) || [];
    
    if (profileIds.length === 0) {
      throw new Error('No profiles found');
    }

    const { error } = await supabase
      .from('pins')
      .delete()
      .eq('id', pinId)
      .in('profile_id', profileIds);

    if (error) {
      console.error('Error deleting pin:', error);
      throw new Error(`Failed to delete pin: ${error.message}`);
    }
  }

  /**
   * Get a pin by ID with tags
   * For anonymous users, returns pin only if it's public
   */
  static async getPinById(pinId: string): Promise<Pin | null> {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('pins')
      .select(`
        *,
        tags (
          id,
          slug,
          label,
          emoji,
          description,
          entity_type,
          display_order,
          is_active,
          is_public
        )
      `)
      .eq('id', pinId);

    if (user) {
      // Get user's profile IDs
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (account) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('account_id', account.id);

        const profileIds = profiles?.map(p => p.id) || [];
        
        if (profileIds.length > 0) {
          const profileIdFilters = profileIds.map(id => `profile_id.eq.${id}`).join(',');
          query = query.or(`visibility.eq.public,${profileIdFilters}`);
        } else {
          query = query.eq('visibility', 'public');
        }
      } else {
        query = query.eq('visibility', 'public');
      }
    } else {
      // Anonymous users can only see public pins
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching pin:', error);
      throw new Error(`Failed to fetch pin: ${error.message}`);
    }

    if (!data) return null;

    // Parse media if it's a string (JSONB can come as string)
    let media = data.media;
    if (typeof media === 'string') {
      try {
        media = JSON.parse(media);
      } catch (e) {
        console.warn('Failed to parse media JSON:', e);
        media = null;
      }
    }

    // Transform to include tag object and backward compatibility
    return {
      ...data,
      tag: data.tags || null,
      tags: undefined,
      media: media || null,
      // Backward compatibility: map lng to long
      long: data.lng,
    };
  }

  /**
   * Get pins for map display with bounding box
   * Optimized query for map rendering
   */
  static async getPinsForMap(filters: {
    tag_id?: string | string[];
    bbox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
    status?: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  }): Promise<Pin[]> {
    return this.getPins({
      ...filters,
      status: filters.status || 'active',
    });
  }

  /**
   * Get all unique tags used by a user's pins
   */
  static async getUserTags(accountId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('pins')
      .select('tags')
      .eq('account_id', accountId)
      .not('tags', 'is', null);

    if (error) {
      console.error('Error fetching user tags:', error);
      return [];
    }

    // Flatten and dedupe tags
    const allTags = data?.flatMap(pin => pin.tags || []) || [];
    return [...new Set(allTags)].sort();
  }

  /**
   * Get pins filtered by tag
   */
  static async getPinsByTag(accountId: string, tag: string): Promise<Pin[]> {
    const { data, error } = await supabase
      .from('pins')
      .select('*')
      .eq('account_id', accountId)
      .contains('tags', [tag]);

    if (error) {
      console.error('Error fetching pins by tag:', error);
      return [];
    }

    return data || [];
  }
}

