import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * GET /api/maps/[id]/pins
 * Get all pins for a map (accessible if map is accessible)
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
      // RLS will return error if user doesn't have access
      if (mapError?.code === 'PGRST116' || mapError?.message?.includes('row-level security')) {
        return createErrorResponse('You do not have access to this map', 403);
      }
      return createErrorResponse('Map not found', 404);
    }

    // Fetch pins (RLS will handle permissions)
    const { data: pins, error } = await supabase
      .from('map_pins')
      .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
      .eq('map_id', mapId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Map Pins API] Error fetching pins:', error);
      return createErrorResponse('Failed to fetch pins', 500, error.message);
    }

    return createSuccessResponse({ pins: pins || [] });
  } catch (error) {
    console.error('[Map Pins API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * POST /api/maps/[id]/pins
 * Create a new pin on a map (owner only)
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
      emoji,
      caption,
      image_url,
      video_url,
      lat,
      lng,
    } = body;

    // Validate coordinates
    if (lat === undefined || lng === undefined) {
      return createErrorResponse('Latitude and longitude are required', 400);
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return createErrorResponse('Latitude and longitude must be numbers', 400);
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
    if (map.account_id !== accountId) {
      return createErrorResponse('Forbidden - only the map owner can add pins', 403);
    }

    // Create pin
    const insertData = {
      map_id: mapId,
      emoji: emoji?.trim() || null,
      caption: caption?.trim() || null,
      image_url: image_url?.trim() || null,
      video_url: video_url?.trim() || null,
      lat,
      lng,
    };

    const { data: pin, error: insertError } = await supabase
      .from('map_pins')
      .insert(insertData as any)
      .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
      .single();

    if (insertError) {
      console.error('[Map Pins API] Error creating pin:', insertError);
      return createErrorResponse('Failed to create pin', 500, insertError.message);
    }

    return createSuccessResponse(pin, 201);
  } catch (error) {
    console.error('[Map Pins API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

