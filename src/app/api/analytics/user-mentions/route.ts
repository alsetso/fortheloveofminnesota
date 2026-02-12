import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/analytics/user-mentions
 * Returns user's mentions with view counts, filtered by time period
 * Query params: timeFilter (24h, 7d, all)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op for server component
        },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get time filter from query params
    const url = new URL(request.url);
    const timeFilter = url.searchParams.get('timeFilter') || 'all';

    // Get live map ID first
    const { data: liveMap } = await supabase
      .schema('maps')
      .from('maps')
      .select('id')
      .eq('slug', 'live')
      .eq('is_active', true)
      .single();

    if (!liveMap) {
      return NextResponse.json(
        { error: 'Live map not found' },
        { status: 500 }
      );
    }

    // Build query for user's mentions (now map_pins on live map)
    let query = supabase
      .schema('maps')
      .from('pins')
      .select('id, description, image_url, created_at, view_count')
      .eq('map_id', liveMap.id)
      .eq('account_id', account.id)
      .eq('archived', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Apply time filter
    if (timeFilter === '24h') {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', twentyFourHoursAgo);
    } else if (timeFilter === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', sevenDaysAgo);
    }
    // 'all' - no time filter

    const { data: mentions, error } = await query;

    if (error) {
      console.error('Error fetching user mentions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch mentions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mentions: mentions || [],
      timeFilter,
    });
  } catch (error) {
    console.error('[user-mentions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user mentions' },
      { status: 500 }
    );
  }
}
