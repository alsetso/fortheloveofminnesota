import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/live/data
 * Aggregate endpoint for live map: returns map + stats + pins in one call
 * Simplified version without memberships/areas
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Get live map by slug
    const { data: map, error: mapError } = await (supabase as any)
      .schema('maps')
      .from('maps')
      .select('*')
      .eq('slug', 'live')
      .eq('is_active', true)
      .maybeSingle();
    
    if (mapError) {
      console.error('[Live Map Data API] Error fetching map:', mapError);
      return createErrorResponse('Failed to fetch live map', 500);
    }
    
    if (!map) {
      return createErrorResponse('Live map not found', 404);
    }
    
    const mapId = map.id;
    
    // Fetch pins (simplified - no areas/members)
    const { data: pins, error: pinsError } = await (supabase as any)
      .schema('maps')
      .from('pins')
      .select(`
        id,
        map_id,
        geometry,
        body,
        caption,
        emoji,
        image_url,
        video_url,
        icon_url,
        media_type,
        full_address,
        map_meta,
        atlas_meta,
        view_count,
        tagged_account_ids,
        visibility,
        archived,
        is_active,
        post_date,
        created_at,
        updated_at,
        author_account_id,
        tag_id,
        mention_type:tags(
          id,
          emoji,
          name
        )
      `)
      .eq('map_id', mapId)
      .eq('archived', false)
      .eq('is_active', true)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (pinsError) {
      console.error('[Live Map Data API] Error fetching pins:', pinsError);
      // Don't fail completely if pins fail, just return empty array
    }
    
    // Transform pins to extract lat/lng from geometry
    const transformedPins = (pins || []).map((pin: any) => {
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (pin.geometry) {
        try {
          const geom = typeof pin.geometry === 'string' ? JSON.parse(pin.geometry) : pin.geometry;
          if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
            lng = geom.coordinates[0];
            lat = geom.coordinates[1];
          }
        } catch (e) {
          // Geometry parsing failed
        }
      }
      
      return {
        ...pin,
        lat: lat ?? 0,
        lng: lng ?? 0,
        description: pin.body || null,
        account_id: pin.author_account_id || null,
      };
    });
    
    // Fetch account images separately
    const accountIds = [...new Set(transformedPins
      .map((p: any) => p.author_account_id)
      .filter((id: any) => id !== null))];
    
    let accountImages: Record<string, any> = {};
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name, image_url')
        .in('id', accountIds);
      
      if (accounts) {
        accountImages = accounts.reduce((acc: Record<string, any>, account: any) => {
          acc[account.id] = account;
          return acc;
        }, {});
      }
    }
    
    // Add account data to pins
    const pinsWithAccounts = transformedPins.map((pin: any) => ({
      ...pin,
      account: pin.author_account_id ? accountImages[pin.author_account_id] || null : null,
    }));
    
    // Fetch mention types (maps.tags) for filter chips
    const { data: tags } = await (supabase as any)
      .schema('maps')
      .from('tags')
      .select('id, emoji, name')
      .eq('is_active', true)
      .order('name');

    const stats = {
      total_views: 0,
      unique_viewers: 0,
      accounts_viewed: 0,
    };

    return NextResponse.json({
      map: {
        ...map,
        account: null,
      },
      stats: { stats },
      pins: pinsWithAccounts,
      tags: tags || [],
      areas: [],
      members: null,
    });
    
  } catch (error) {
    console.error('[Live Map Data API] Exception:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch live map data',
      500
    );
  }
}
