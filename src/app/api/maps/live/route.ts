import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/live
 * Get the live map ID
 * Simple endpoint that returns just the map ID for the 'live' map
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Get live map by slug - select only what we need, RLS will handle visibility
    const { data: map, error } = await (supabase as any)
      .schema('maps')
      .from('maps')
      .select('id, name, slug, visibility, is_active, owner_account_id')
      .eq('slug', 'live')
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) {
      console.error('[Live Map API] Error:', error);
      console.error('[Live Map API] Error code:', error.code);
      console.error('[Live Map API] Error message:', error.message);
      return createErrorResponse('Failed to fetch live map', 500, { 
        error_code: error.code,
        error_message: error.message,
        hint: error.hint
      });
    }
    
    if (!map) {
      // Try without is_active to see if map exists
      const { data: checkMap } = await (supabase as any)
        .schema('maps')
        .from('maps')
        .select('id, name, slug, is_active, visibility')
        .eq('slug', 'live')
        .maybeSingle();
      
      if (checkMap) {
        console.warn('[Live Map API] Map exists but filtered out:', {
          is_active: checkMap.is_active,
          visibility: checkMap.visibility
        });
      }
      
      return createErrorResponse('Live map not found', 404);
    }
    
    // Check visibility - public/unlisted maps are visible to everyone
    if (map.visibility === 'private') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return createErrorResponse('Map not found', 404);
      }
    }
    
    // Return just the ID (for backward compatibility with existing code)
    return NextResponse.json({
      id: map.id,
      name: map.name,
      slug: map.slug,
    });
    
  } catch (error) {
    console.error('[Live Map API] Exception:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch live map',
      500
    );
  }
}
