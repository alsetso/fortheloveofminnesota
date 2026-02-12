import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/dynamic/[identifier]
 * Get a map by ID or slug
 * 
 * Simple, straightforward map lookup
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params;
    const supabase = await createServerClientWithAuth(cookies());
    
    // Try to find map by ID first, then by slug
    let map = null;
    
    // Check if identifier is a UUID (36 chars with dashes)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    if (isUUID) {
      // Lookup by ID
      const { data, error } = await (supabase as any)
        .schema('maps')
        .from('maps')
        .select('*')
        .eq('id', identifier)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        return createErrorResponse('Failed to fetch map', 500);
      }
      
      map = data;
    } else {
      // Lookup by slug
      const { data, error } = await (supabase as any)
        .schema('maps')
        .from('maps')
        .select('*')
        .eq('slug', identifier)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        return createErrorResponse('Failed to fetch map', 500);
      }
      
      map = data;
    }
    
    if (!map) {
      return createErrorResponse('Map not found', 404);
    }
    
    // Check visibility - public/unlisted maps are visible to everyone
    // Private maps require authentication and ownership check
    if (map.visibility === 'private') {
      // For private maps, check if user owns it
      // This is a simplified check - you can expand this later
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return createErrorResponse('Map not found', 404); // Don't reveal private maps exist
      }
      
      // Check ownership (simplified - expand with accounts later)
      // For now, if authenticated, allow access (you can add ownership check)
    }
    
    return NextResponse.json({
      map,
      found: true
    });
    
  } catch (error) {
    console.error('[Dynamic Maps API] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch map',
      500
    );
  }
}
