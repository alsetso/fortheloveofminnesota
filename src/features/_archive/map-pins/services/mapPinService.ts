import { supabase } from '@/lib/supabase';
import { Tag } from '@/features/tags/services/tagService';

export interface PinMedia {
  type: 'image' | 'video';
  url: string;
  filename: string;
  mime_type?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail_url?: string;
  order?: number;
  uploaded_at?: string;
}

export interface MapPin {
  id: string;
  profile_id: string | null;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  visibility: 'public' | 'private' | 'accounts_only';
  status: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  emoji?: string;
  address?: string;
  tag_id: string | null;
  tag?: Tag;
  media?: PinMedia[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMapPinData {
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  visibility?: 'public' | 'private' | 'accounts_only';
  emoji?: string;
  address?: string;
  tag_id: string;
  profile_id: string;
  media?: PinMedia[] | null;
}

export interface UpdateMapPinData {
  name?: string;
  description?: string | null;
  lat?: number;
  lng?: number;
  visibility?: 'public' | 'private' | 'accounts_only';
  status?: 'active' | 'draft' | 'archived' | 'hidden' | 'completed';
  emoji?: string;
  address?: string;
  tag_id?: string;
  media?: PinMedia[] | null;
}

export interface MapPinFilters {
  tagIds?: string[];
  profileId?: string | null;
  visibility?: { public: boolean; private: boolean };
}

export class MapPinService {
  /**
   * Get pins for map with filtering
   * DISABLED: Map pins fetching removed
   */
  static async getPins(filters?: MapPinFilters): Promise<MapPin[]> {
    // Map pins fetching has been disabled
    return [];

    // Filter by status - only active pins
    query = query.eq('status', 'active');

    // Filter by tag IDs
    if (filters?.tagIds && filters.tagIds.length > 0) {
      query = query.in('tag_id', filters.tagIds);
    }

    // Filter by profile ID
    if (filters?.profileId) {
      query = query.eq('profile_id', filters.profileId);
    }

    // Apply visibility filter based on user authentication and filter settings
    if (filters?.visibility) {
      const visibilityConditions: string[] = [];
      
      if (filters.visibility.public) {
        visibilityConditions.push('visibility.eq.public');
      }
      
      if (filters.visibility.private) {
        if (user) {
          // For private pins, user must own them
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
              visibilityConditions.push(`visibility.eq.private,${profileIdFilters}`);
            }
          }
        }
      }
      
      if (visibilityConditions.length > 0) {
        query = query.or(visibilityConditions.join(','));
      } else {
        // No visibility selected, return empty
        return [];
      }
    } else {
      // Default visibility behavior
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
        query = query.eq('visibility', 'public');
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching map pins:', error);
      throw new Error(`Failed to fetch pins: ${error.message}`);
    }

    // Transform data
    const transformedPins = (data || []).map((pin: PinData) => {
      let tag = null;
      if (pin.tags) {
        if (Array.isArray(pin.tags)) {
          tag = pin.tags[0] || null;
        } else {
          tag = pin.tags;
        }
      }
      
      return {
        ...pin,
        tag,
        tags: undefined,
      };
    });

    return transformedPins;
  }

  /**
   * Create a new pin
   */
  static async createPin(data: CreateMapPinData): Promise<MapPin> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to create pins');
    }

    const { data: pin, error } = await supabase
      .from('pins')
      .insert({
        ...data,
        user_id: user.id,
        status: 'active',
      })
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
      `)
      .single();

    if (error) {
      console.error('Error creating pin:', error);
      throw new Error(`Failed to create pin: ${error.message}`);
    }

    // Transform data
    let tag = null;
    if (pin.tags) {
      if (Array.isArray(pin.tags)) {
        tag = pin.tags[0] || null;
      } else {
        tag = pin.tags;
      }
    }

    return {
      ...pin,
      tag,
      tags: undefined,
    };
  }

  /**
   * Update a pin
   */
  static async updatePin(pinId: string, data: UpdateMapPinData): Promise<MapPin> {
    const { data: pin, error } = await supabase
      .from('pins')
      .update(data)
      .eq('id', pinId)
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
      `)
      .single();

    if (error) {
      console.error('Error updating pin:', error);
      throw new Error(`Failed to update pin: ${error.message}`);
    }

    // Transform data
    let tag = null;
    if (pin.tags) {
      if (Array.isArray(pin.tags)) {
        tag = pin.tags[0] || null;
      } else {
        tag = pin.tags;
      }
    }

    return {
      ...pin,
      tag,
      tags: undefined,
    };
  }

  /**
   * Delete a pin
   */
  static async deletePin(pinId: string): Promise<void> {
    const { error } = await supabase
      .from('pins')
      .delete()
      .eq('id', pinId);

    if (error) {
      console.error('Error deleting pin:', error);
      throw new Error(`Failed to delete pin: ${error.message}`);
    }
  }
}

