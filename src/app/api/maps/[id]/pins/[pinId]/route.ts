import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * PUT /api/maps/[id]/pins/[pinId]
 * Update a pin (owner only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  try {
    const { id: mapId, pinId } = await params;
    const auth = await getServerAuth();
    
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());
    const body = await request.json();

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
      return createErrorResponse('Forbidden - only the map owner can update pins', 403);
    }

    // Verify pin exists and belongs to this map
    const { data: pin, error: pinError } = await supabase
      .from('map_pins')
      .select('id, map_id')
      .eq('id', pinId)
      .eq('map_id', mapId)
      .single();

    if (pinError || !pin) {
      return createErrorResponse('Pin not found', 404);
    }

    // Build update data
    const updateData: Partial<Database['public']['Tables']['map_pins']['Update']> = {};

    if (body.emoji !== undefined) {
      updateData.emoji = body.emoji?.trim() || null;
    }
    if (body.caption !== undefined) {
      updateData.caption = body.caption?.trim() || null;
    }
    if (body.image_url !== undefined) {
      updateData.image_url = body.image_url?.trim() || null;
    }
    if (body.video_url !== undefined) {
      updateData.video_url = body.video_url?.trim() || null;
    }

    // Update pin
    const { data: updatedPin, error: updateError } = await supabase
      .from('map_pins')
      .update(updateData as any)
      .eq('id', pinId)
      .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('[Map Pins API] Error updating pin:', updateError);
      return createErrorResponse('Failed to update pin', 500, updateError.message);
    }

    return createSuccessResponse(updatedPin);
  } catch (error) {
    console.error('[Map Pins API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

