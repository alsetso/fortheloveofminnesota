import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/[id]/areas
 * Get all areas for a map (accessible if map is accessible)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mapId } = await params;
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

    // Fetch areas (RLS will handle permissions)
    const { data: areas, error } = await supabase
      .from('map_areas')
      .select('id, map_id, name, description, geometry, created_at, updated_at')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Map Areas API] Error fetching areas:', error);
      return createErrorResponse('Failed to fetch areas', 500, error.message);
    }

    return createSuccessResponse({ areas: areas || [] });
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
 * POST /api/maps/[id]/areas
 * Create a new area on a map (owner only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mapId } = await params;
    const auth = await getServerAuth();
    
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());
    const body = await request.json();

    const {
      name,
      description,
      geometry,
    } = body;

    // Validate geometry
    if (!geometry || !geometry.type || !geometry.coordinates) {
      return createErrorResponse('Valid GeoJSON geometry is required', 400);
    }

    if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      return createErrorResponse('Geometry must be a Polygon or MultiPolygon', 400);
    }

    if (!name || name.trim().length === 0) {
      return createErrorResponse('Name is required', 400);
    }

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
    const mapData = map as { id: string; account_id: string };
    if (mapData.account_id !== accountId) {
      return createErrorResponse('Forbidden - only the map owner can add areas', 403);
    }

    // Create area
    const insertData = {
      map_id: mapId,
      name: name.trim(),
      description: description?.trim() || null,
      geometry,
    };

    const { data: area, error: insertError } = await supabase
      .from('map_areas')
      .insert(insertData as any)
      .select()
      .single();

    if (insertError) {
      console.error('[Map Areas API] Error creating area:', insertError);
      return createErrorResponse('Failed to create area', 500, insertError.message);
    }

    return createSuccessResponse(area, 201);
  } catch (error) {
    console.error('[Map Areas API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}


