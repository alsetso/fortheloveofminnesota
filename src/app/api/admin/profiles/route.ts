import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/adminHelpers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * GET /api/admin/profiles
 * List all profiles with their account information (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const supabase = await createServerClientWithAuth(cookies());
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const accountId = searchParams.get('account_id');

    let query = supabase
      .from('profiles')
      .select(`
        id,
        account_id,
        username,
        profile_image,
        profile_type,
        onboarded,
        created_at,
        updated_at,
        accounts (
          id,
          user_id,
          email,
          first_name,
          last_name,
          username
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by account if provided
    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: profiles, error } = await query;

    if (error) {
      console.error('[Admin Profiles API] Error fetching profiles:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Get total count
    let countQuery = supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (accountId) {
      countQuery = countQuery.eq('account_id', accountId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[Admin Profiles API] Error counting profiles:', countError);
    }

    return NextResponse.json({
      profiles: profiles || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Admin Profiles API] Error:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/profiles
 * Create a new profile (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      account_id,
      username,
      profile_image,
      profile_type = 'homeowner',
    } = body;

    if (!account_id) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { error: 'username is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClientWithAuth(cookies());

    // Verify account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .maybeSingle();

    if (accountError) {
      console.error('[Admin Profiles API] Error checking account:', accountError);
      return NextResponse.json(
        { error: 'Failed to verify account' },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check if username already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        account_id,
        username,
        profile_image: profile_image || null,
        profile_type,
      })
      .select(`
        id,
        account_id,
        username,
        profile_image,
        profile_type,
        onboarded,
        created_at,
        updated_at,
        accounts (
          id,
          user_id,
          email,
          first_name,
          last_name,
          username
        )
      `)
      .single();

    if (profileError) {
      console.error('[Admin Profiles API] Error creating profile:', profileError);
      return NextResponse.json(
        { error: profileError.message || 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error('[Admin Profiles API] Error:', error);
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

