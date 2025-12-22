import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

type EntityType = 'account' | 'mention';

interface EntityWithViews {
  entity_type: EntityType;
  entity_id: string;
  entity_slug: string | null;
  title: string;
  total_views: number;
  unique_visitors: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
  url: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entity_type') as EntityType | null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
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

    // Get current user account
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error in my-entities:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      );
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, username')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return NextResponse.json(
        { error: 'Failed to fetch account' },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found. Please complete your profile setup.' },
        { status: 404 }
      );
    }

    const accountId = (account as { id: string; username: string | null }).id;
    const entities: EntityWithViews[] = [];

    // Get user's account/profile with stats
    if (!entityType || entityType === 'account') {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name, created_at')
        .eq('id', accountId)
        .single();

      if (accountData) {
        const accountDataTyped = accountData as { id: string; username: string | null; first_name: string | null; last_name: string | null; created_at: string };
        
        // Get stats for account profile page
        const profileUrl = accountDataTyped.username ? `/profile/${accountDataTyped.username}` : `/account/settings`;
        const { data: stats } = await supabase.rpc('get_page_stats', {
          p_page_url: profileUrl,
          p_hours: null, // All time
        } as any);

        const statsData = (stats as any)?.[0] || {};
        
        // Get first and last viewed dates
        const { data: firstView } = await supabase
          .from('page_views')
          .select('viewed_at')
          .eq('page_url', profileUrl)
          .order('viewed_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const { data: lastView } = await supabase
          .from('page_views')
          .select('viewed_at')
          .eq('page_url', profileUrl)
          .order('viewed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        entities.push({
          entity_type: 'account',
          entity_id: accountDataTyped.id,
          entity_slug: accountDataTyped.username,
          title: `${accountDataTyped.first_name || ''} ${accountDataTyped.last_name || ''}`.trim() || 'My Account',
          total_views: statsData.total_views || 0,
          unique_visitors: statsData.unique_viewers || 0,
          first_viewed_at: (firstView as any)?.viewed_at || null,
          last_viewed_at: (lastView as any)?.viewed_at || null,
          created_at: accountDataTyped.created_at,
          url: profileUrl,
        });
      }
    }

    // Get user's mentions (excluding archived)
    if (!entityType || entityType === 'mention') {
      const { data: mentions } = await supabase
        .from('mentions')
        .select('id, description, created_at')
        .eq('account_id', accountId)
        .eq('archived', false) // Exclude archived mentions
        .order('created_at', { ascending: false });

      if (mentions) {
        for (const mention of mentions) {
          const mentionData = mention as { id: string; description: string | null; created_at: string };

          entities.push({
            entity_type: 'mention',
            entity_id: mentionData.id,
            entity_slug: null,
            title: mentionData.description || 'Mention',
            total_views: 0, // Mentions don't have view tracking yet
            unique_visitors: 0,
            first_viewed_at: null,
            last_viewed_at: null,
            created_at: mentionData.created_at,
            url: '#', // Mentions don't have direct URLs
          });
        }
      }
    }

    // Sort by last_viewed_at (most recent first), then by created_at
    entities.sort((a, b) => {
      if (a.last_viewed_at && b.last_viewed_at) {
        return new Date(b.last_viewed_at).getTime() - new Date(a.last_viewed_at).getTime();
      }
      if (a.last_viewed_at) return -1;
      if (b.last_viewed_at) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      entities,
      total: entities.length,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/my-entities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
