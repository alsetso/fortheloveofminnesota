import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { createErrorResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/dynamic
 * List all active maps (simple, for discovery)
 * 
 * Query params:
 * - limit: number of maps to return (default: 50)
 * - offset: pagination offset (default: 0)
 * - visibility: filter by visibility (default: 'public')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const visibility = url.searchParams.get('visibility') || 'public';
    
    // Fetch active maps
    const { data: maps, error } = await (supabase as any)
      .schema('maps')
      .from('maps')
      .select('id, name, slug, description, visibility, is_active, created_at, updated_at')
      .eq('is_active', true)
      .eq('visibility', visibility)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('[Dynamic Maps List API] Error:', error);
      return createErrorResponse('Failed to fetch maps', 500);
    }
    
    return NextResponse.json({
      maps: maps || [],
      count: maps?.length || 0,
    });
    
  } catch (error) {
    console.error('[Dynamic Maps List API] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to fetch maps',
      500
    );
  }
}
