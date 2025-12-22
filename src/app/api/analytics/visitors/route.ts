import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import type { Visitor } from '@/types/analytics';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const searchParams = request.nextUrl.searchParams;
    const page_url = searchParams.get('page_url');
    const mention_id = searchParams.get('mention_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!page_url && !mention_id) {
      return NextResponse.json(
        { error: 'Either page_url or mention_id is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies, but this endpoint doesn't need to
          },
        },
      }
    );

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get account
    const { data: account } = await supabase
      .from('accounts')
      .select('id, username')
      .eq('user_id', user.id)
      .single() as { data: { id: string; username: string | null } | null; error: any };

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    let isOwner = false;
    if (page_url) {
      // For page URLs, check if it's the user's profile page
      const profileUrl = account.username ? `/profile/${account.username}` : `/account/settings`;
      isOwner = page_url === profileUrl;
      
      // Could also check other owned pages here (e.g., user-created pages)
    } else if (mention_id) {
      // For mentions, check if user owns the mention
      const { data: mention } = await supabase
        .from('mentions')
        .select('account_id')
        .eq('id', mention_id)
        .single() as { data: { account_id: string } | null; error: any };
      isOwner = (mention as { account_id: string } | null)?.account_id === account.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { error: 'You can only view visitors to your own content' },
        { status: 403 }
      );
    }

    // Get visitors using the new functions
    let visitors: Visitor[] | null = null;
    let error: any = null;

    if (page_url) {
      const result = await supabase.rpc('get_page_viewers', {
        p_page_url: page_url,
        p_limit: limit,
        p_offset: offset,
      } as any);
      visitors = result.data as Visitor[] | null;
      error = result.error;
    } else if (mention_id) {
      // Note: get_pin_viewers function may need to be updated to get_mention_viewers
      // For now, returning empty array as mentions don't have view tracking yet
      visitors = [];
      error = null;
    }

    if (error) {
      console.error('Error getting visitors:', error);
      return NextResponse.json(
        { error: 'Failed to get visitors', details: error.message },
        { status: 500 }
      );
    }

    const visitorsArray = (visitors || []) as Visitor[];
    return NextResponse.json({
      visitors: visitorsArray,
      total: visitorsArray.length,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/visitors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

