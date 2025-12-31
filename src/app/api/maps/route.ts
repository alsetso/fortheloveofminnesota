import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * GET /api/maps
 * List maps with optional filters (visibility, account_id)
 * Public maps visible to all, private maps only to owner
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    const supabase = auth 
      ? await createServerClientWithAuth(cookies())
      : createServerClient();

    const searchParams = request.nextUrl.searchParams;
    const visibility = searchParams.get('visibility'); // 'public' | 'private' | 'shared'
    const accountId = searchParams.get('account_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
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
      .order('created_at', { ascending: false });

    // Apply filters
    if (visibility) {
      query = query.eq('visibility', visibility);
    }

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    // For anonymous users, only show public maps
    // For authenticated users, RLS will handle visibility (public + own private)
    if (!auth) {
      query = query.eq('visibility', 'public');
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: maps, error } = await query;

    if (error) {
      console.error('[Maps API] Error fetching maps:', error);
      return createErrorResponse('Failed to fetch maps', 500, error.message);
    }

    return createSuccessResponse({
      maps: maps || [],
      limit,
      offset,
    });
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
 * POST /api/maps
 * Create a new map (authenticated users only)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth) {
      return createErrorResponse('Unauthorized - authentication required', 401);
    }

    const supabase = await createServerClientWithAuth(cookies());
    
    // Verify user session is loaded
    const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !supabaseUser) {
      return createErrorResponse('Authentication failed - user session not found', 401);
    }
    
    // Verify auth.uid() matches
    if (supabaseUser.id !== auth.id) {
      return createErrorResponse('Authentication mismatch', 401);
    }
    
    const body = await request.json();

    const {
      title,
      description,
      visibility = 'private',
      map_style = 'street',
      meta = {},
    } = body;

    // Validation
    if (!title || title.trim().length === 0) {
      return createErrorResponse('Title is required', 400);
    }

    // Validate visibility
    if (!['public', 'private', 'shared'].includes(visibility)) {
      return createErrorResponse('Invalid visibility. Must be public, private, or shared', 400);
    }

    // Validate map_style
    if (!['street', 'satellite', 'light', 'dark'].includes(map_style)) {
      return createErrorResponse('Invalid map_style. Must be street, satellite, light, or dark', 400);
    }

    // Get account_id for current user
    let accountId: string;
    try {
      accountId = await getAccountIdForUser(auth, supabase);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Account not found. Please complete your profile setup.',
        404
      );
    }

    const insertData: Database['public']['Tables']['map']['Insert'] = {
      account_id: accountId,
      title: title.trim(),
      description: description?.trim() || null,
      visibility,
      map_style: map_style as 'street' | 'satellite',
      meta: meta || {},
    };

    const { data: map, error } = await supabase
      .from('map')
      .insert(insertData as any)
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

    if (error) {
      console.error('[Maps API] Error creating map:', error);
      return createErrorResponse('Failed to create map', 500, error.message);
    }

    return createSuccessResponse(map, 201);
  } catch (error) {
    console.error('[Maps API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

