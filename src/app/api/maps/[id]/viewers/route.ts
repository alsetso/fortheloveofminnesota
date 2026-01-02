import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';

/**
 * GET /api/maps/[id]/viewers
 * Get list of accounts that viewed this map
 * Only accessible by map owner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getServerAuth();
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { id: mapId } = await params;
    const supabase = await createServerClientWithAuth(cookies());

    // Get current user's account
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { data: accountData } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!accountData) {
      return createErrorResponse('Account not found', 404);
    }

    // Verify user owns the map
    const { data: mapData } = await supabase
      .from('map')
      .select('account_id')
      .eq('id', mapId)
      .single();

    if (!mapData) {
      return createErrorResponse('Map not found', 404);
    }

    if (mapData.account_id !== accountData.id) {
      return createErrorResponse('Forbidden', 403);
    }

    // Get viewers using the public wrapper RPC function
    // After migration 345, this should be available as public.get_map_viewers
    const { data: viewersData, error } = await supabase.rpc('get_map_viewers', {
      p_map_id: mapId,
      p_limit: 100,
      p_offset: 0,
    } as any);

    if (error) {
      console.error('Error fetching map viewers:', error);
      // Return empty array if function doesn't exist yet (migration not applied)
      // This allows the UI to work even if migration hasn't been run
      return createSuccessResponse({
        viewers: [],
      });
    }

    return createSuccessResponse({
      viewers: viewersData || [],
    });
  } catch (err) {
    console.error('Error in GET /api/maps/[id]/viewers:', err);
    return createErrorResponse('Internal server error', 500);
  }
}
