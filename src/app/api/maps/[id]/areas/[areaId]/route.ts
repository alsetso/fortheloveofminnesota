import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/[id]/areas/[areaId]
 * Get a single area (accessible if map is accessible)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  try {
    const { id: mapId, areaId } = await params;
    const auth = await getServerAuth();
    const supabase = auth 
      ? await createServerClientWithAuth(cookies())
      : createServerClient();

    // Verify map exists (RLS will handle access permissions)
    const { data: map, error: mapError } = await supabase
      .from('map')
      .select('id, account_id, visibility')
      .eq('id', mapId)
      .single();

    if (mapError || !map) {
      if (mapError?.code === 'PGRST116' || mapError?.message?.includes('row-level security')) {
        return createErrorResponse('You do not have access to this map', 403);
      }
      return createErrorResponse('Map not found', 404);
    }

    // Fetch area (RLS will handle permissions)
    const { data: area, error } = await supabase
      .from('map_areas')
      .select('id, map_id, name, description, geometry, created_at, updated_at')
      .eq('id', areaId)
      .eq('map_id', mapId)
      .single();

    if (error || !area) {
      if (error?.code === 'PGRST116') {
        return createErrorResponse('Area not found', 404);
      }
      return createErrorResponse('Failed to fetch area', 500, error.message);
    }

    return createSuccessResponse(area);
  } catch (error) {
    console.error('[Map Areas API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * DELETE /api/maps/[id]/areas/[areaId]
 * Delete an area (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  try {
    const { id: mapId, areaId } = await params;
    const auth = await getServerAuth();
    
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());

    // Verify map exists and user owns it
    const { data: map, error: mapError } = await supabase
      .from('map')
      .select('id, account_id')
      .eq('id', mapId)
      .single();

    if (mapError || !map) {
      return createErrorResponse('Map not found', 404);
    }

    // Get user's account
    let accountId: string;
    try {
      accountId = await getAccountIdForUser(auth, supabase);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Account not found',
        404
      );
    }

    // Verify user owns the map
    if (map.account_id !== accountId) {
      return createErrorResponse('Forbidden - only the map owner can delete areas', 403);
    }

    // Verify area exists and belongs to this map
    const { data: area, error: areaError } = await supabase
      .from('map_areas')
      .select('id, map_id')
      .eq('id', areaId)
      .eq('map_id', mapId)
      .single();

    if (areaError || !area) {
      return createErrorResponse('Area not found', 404);
    }

    // Delete area
    const { error: deleteError } = await supabase
      .from('map_areas')
      .delete()
      .eq('id', areaId);

    if (deleteError) {
      console.error('[Map Areas API] Error deleting area:', deleteError);
      return createErrorResponse('Failed to delete area', 500, deleteError.message);
    }

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error('[Map Areas API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}


