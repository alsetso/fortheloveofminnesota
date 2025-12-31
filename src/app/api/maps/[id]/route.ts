import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * GET /api/maps/[id]
 * Get a single map with point count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getServerAuth();
    const supabase = auth 
      ? await createServerClientWithAuth(cookies())
      : createServerClient();

    // Fetch map (RLS will filter based on permissions)
    const { data: map, error } = await supabase
      .from('map')
      .select(`
        id,
        account_id,
        title,
        description,
        visibility,
        map_style,
        meta,
        created_at,
        updated_at,
        account:accounts!inner(
          id,
          username,
          first_name,
          last_name,
          image_url
        )
      `)
      .eq('id', id)
      .single();

    if (error || !map) {
      // Check if it's a permission error (RLS blocked access)
      if (error?.code === 'PGRST116' || error?.message?.includes('row-level security')) {
        return createErrorResponse('You do not have access to this map', 403);
      }
      return createErrorResponse('Map not found', 404);
    }

    // RLS already handles permission checks, so if we get here, user has access
    return createSuccessResponse(map);
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * PUT /api/maps/[id]
 * Update a map (owner only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getServerAuth();
    
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());
    const body = await request.json();

    // Check if user owns the map
    const { data: map, error: mapError } = await supabase
      .from('map')
      .select('account_id')
      .eq('id', id)
      .single();

    if (mapError || !map) {
      return createErrorResponse('Map not found', 404);
    }

    // Get user's account and verify ownership
    let accountId: string;
    try {
      accountId = await getAccountIdForUser(auth, supabase);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Account not found',
        404
      );
    }

    if (accountId !== map.account_id) {
      return createErrorResponse('Forbidden - you do not own this map', 403);
    }

    // Build update data
    const updateData: Partial<Database['public']['Tables']['map']['Update']> = {};

    if (body.title !== undefined) {
      if (!body.title || body.title.trim().length === 0) {
        return createErrorResponse('Title cannot be empty', 400);
      }
      updateData.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    if (body.visibility !== undefined) {
      if (!['public', 'private', 'shared'].includes(body.visibility)) {
        return createErrorResponse('Invalid visibility. Must be public, private, or shared', 400);
      }
      updateData.visibility = body.visibility;
    }

    if (body.map_style !== undefined) {
      if (!['street', 'satellite', 'light', 'dark'].includes(body.map_style)) {
        return createErrorResponse('Invalid map_style. Must be street, satellite, light, or dark', 400);
      }
      updateData.map_style = body.map_style as 'street' | 'satellite' | 'light' | 'dark';
    }

    if (body.meta !== undefined) {
      updateData.meta = body.meta;
    }

    const { data: updatedMap, error: updateError } = await supabase
      .from('map')
      .update(updateData as any)
      .eq('id', id)
      .select(`
        id,
        account_id,
        title,
        description,
        visibility,
        map_style,
        meta,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error('[Maps API] Error updating map:', updateError);
      return createErrorResponse('Failed to update map', 500, updateError.message);
    }

    return createSuccessResponse(updatedMap);
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * DELETE /api/maps/[id]
 * Delete a map (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getServerAuth();
    
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());

    // Check if user owns the map
    const { data: map, error: mapError } = await supabase
      .from('map')
      .select('account_id')
      .eq('id', id)
      .single();

    if (mapError || !map) {
      return createErrorResponse('Map not found', 404);
    }

    // Get user's account and verify ownership
    let accountId: string;
    try {
      accountId = await getAccountIdForUser(auth, supabase);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Account not found',
        404
      );
    }

    if (accountId !== map.account_id) {
      return createErrorResponse('Forbidden - you do not own this map', 403);
    }

    // Delete map
    const { error: deleteError } = await supabase
      .from('map')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Maps API] Error deleting map:', deleteError);
      return createErrorResponse('Failed to delete map', 500, deleteError.message);
    }

    return createSuccessResponse({ success: true });
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

