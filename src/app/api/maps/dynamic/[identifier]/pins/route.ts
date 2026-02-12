import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/dynamic/[identifier]/pins
 * Get pins for a map by map ID or slug
 * 
 * Simple, straightforward pin fetching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    const supabase = await createServerClientWithAuth(cookies());
    
    // First, find the map by ID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    let mapId: string | null = null;
    
    if (isUUID) {
      // Lookup by ID
      const { data: map } = await (supabase as any)
        .schema('maps')
        .from('maps')
        .select('id')
        .eq('id', identifier)
        .eq('is_active', true)
        .maybeSingle();
      
      mapId = map?.id || null;
    } else {
      // Lookup by slug
      const { data: map } = await (supabase as any)
        .schema('maps')
        .from('maps')
        .select('id')
        .eq('slug', identifier)
        .eq('is_active', true)
        .maybeSingle();
      
      mapId = map?.id || null;
    }
    
    if (!mapId) {
      return createErrorResponse('Map not found', 404);
    }
    
    // Get query parameters for filtering
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const visibility = url.searchParams.get('visibility') || 'public'; // Default to public
    
    // Fetch pins for this map
    const { data: pins, error } = await (supabase as any)
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
      .eq('visibility', visibility)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('[Dynamic Maps Pins API] Error:', error);
      return createErrorResponse('Failed to fetch pins', 500);
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
          } else if (typeof pin.geometry === 'string') {
            const match = pin.geometry.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }
        } catch (e) {
          // Geometry parsing failed, skip
        }
      }
      
      return {
        ...pin,
        lat,
        lng,
        description: pin.body || null,
        account_id: pin.author_account_id || null,
      };
    });
    
    // Fetch account images separately (cross-schema join not supported)
    const accountIds = [...new Set(transformedPins
      .map((p: any) => p.author_account_id)
      .filter((id: any) => id !== null))];
    
    let accountImages: Record<string, string | null> = {};
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, image_url')
        .in('id', accountIds);
      
      if (accounts) {
        accountImages = accounts.reduce((acc: Record<string, string | null>, account: any) => {
          acc[account.id] = account.image_url || null;
          return acc;
        }, {});
      }
    }
    
    // Add account images to pins
    const pinsWithAccounts = transformedPins.map((pin: any) => ({
      ...pin,
      account: pin.author_account_id ? {
        image_url: accountImages[pin.author_account_id] || null
      } : null,
    }));
    
    return NextResponse.json({
      pins: pinsWithAccounts,
      count: pinsWithAccounts.length,
      map_id: mapId,
    });
    
  } catch (error) {
    console.error('[Dynamic Maps Pins API] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch pins',
      500
    );
  }
}
