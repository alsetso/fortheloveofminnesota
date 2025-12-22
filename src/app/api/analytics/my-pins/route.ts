import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

interface PinViewStats {
  pin_id: string;
  pin_description: string | null;
  pin_type: string | null;
  pin_created_at: string;
  total_views: number;
  unique_viewers: number;
  last_viewed_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
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
      console.error('Auth error in my-pins:', authError);
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

    // Get user's mentions (excluding archived)
    const { data: mentions, error: mentionsError } = await supabase
      .from('mentions')
      .select('id, description, type, created_at')
      .eq('account_id', accountId)
      .eq('archived', false)
      .order('created_at', { ascending: false });

    if (mentionsError) {
      console.error('Error fetching mentions:', mentionsError);
      return NextResponse.json(
        { error: 'Failed to fetch mentions' },
        { status: 500 }
      );
    }

    if (!mentions || mentions.length === 0) {
      return NextResponse.json({
        pins: [],
        totals: {
          total_pins: 0,
          total_views: 0,
          total_unique_viewers: 0,
        },
      });
    }

    // Get stats for each mention
    const pins: PinViewStats[] = [];
    let totalViews = 0;
    let totalUniqueViewers = 0;

    for (const mention of mentions) {
      const mentionData = mention as { id: string; description: string | null; type: string | null; created_at: string };

      // Get stats for this mention
      const { data: statsData, error: statsError } = await supabase.rpc('get_pin_stats', {
        p_pin_id: mentionData.id,
        p_hours: null, // All time
      } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

      if (statsError) {
        console.error(`Error fetching stats for mention ${mentionData.id}:`, statsError);
        // Continue with zero stats if there's an error
      }

      const stats = statsData && statsData.length > 0 ? statsData[0] : {
        total_views: 0,
        unique_viewers: 0,
        accounts_viewed: 0,
      };

      // Get last viewed date
      const { data: lastView } = await supabase
        .from('pin_views')
        .select('viewed_at')
        .eq('pin_id', mentionData.id)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastViewedAt = (lastView as any)?.viewed_at || null;

      pins.push({
        pin_id: mentionData.id,
        pin_description: mentionData.description,
        pin_type: mentionData.type,
        pin_created_at: mentionData.created_at,
        total_views: stats.total_views || 0,
        unique_viewers: stats.unique_viewers || 0,
        last_viewed_at: lastViewedAt,
      });

      totalViews += stats.total_views || 0;
      totalUniqueViewers += stats.unique_viewers || 0;
    }

    return NextResponse.json({
      pins,
      totals: {
        total_pins: pins.length,
        total_views: totalViews,
        total_unique_viewers: totalUniqueViewers,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/my-pins:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
