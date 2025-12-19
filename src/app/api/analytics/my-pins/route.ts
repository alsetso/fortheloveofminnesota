import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export interface PinViewStats {
  pin_id: string;
  pin_description: string | null;
  pin_type: string | null;
  pin_created_at: string;
  total_views: number;
  unique_viewers: number;
  last_viewed_at: string | null;
}

export interface MyPinsAnalyticsResponse {
  pins: PinViewStats[];
  totals: {
    total_pins: number;
    total_views: number;
    total_unique_viewers: number;
  };
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const accountId = (account as { id: string }).id;

    // Get all user's pins
    const { data: pins, error: pinsError } = await supabase
      .from('pins')
      .select('id, description, type, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (pinsError) {
      console.error('Error fetching pins:', pinsError);
      return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 });
    }

    if (!pins || pins.length === 0) {
      return NextResponse.json({
        pins: [],
        totals: { total_pins: 0, total_views: 0, total_unique_viewers: 0 },
      });
    }

    // Get view stats for each pin
    const pinStats: PinViewStats[] = [];
    let totalViews = 0;
    let totalUniqueViewers = 0;

    for (const pin of pins) {
      const pinData = pin as {
        id: string;
        description: string | null;
        type: string | null;
        created_at: string;
      };

      // Get stats using RPC
      const { data: stats } = await supabase.rpc('get_pin_stats', {
        p_pin_id: pinData.id,
        p_hours: null,
      });

      const statsData = (stats as { total_views: number; unique_viewers: number }[])?.[0] || {
        total_views: 0,
        unique_viewers: 0,
      };

      // Get last viewed timestamp
      const { data: lastView } = await supabase
        .from('pin_views')
        .select('viewed_at')
        .eq('pin_id', pinData.id)
        .order('viewed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      pinStats.push({
        pin_id: pinData.id,
        pin_description: pinData.description,
        pin_type: pinData.type,
        pin_created_at: pinData.created_at,
        total_views: statsData.total_views || 0,
        unique_viewers: statsData.unique_viewers || 0,
        last_viewed_at: lastView?.viewed_at || null,
      });

      totalViews += statsData.total_views || 0;
      totalUniqueViewers += statsData.unique_viewers || 0;
    }

    // Sort by total views descending
    pinStats.sort((a, b) => b.total_views - a.total_views);

    return NextResponse.json({
      pins: pinStats,
      totals: {
        total_pins: pins.length,
        total_views: totalViews,
        total_unique_viewers: totalUniqueViewers,
      },
    } satisfies MyPinsAnalyticsResponse);
  } catch (error) {
    console.error('Error in GET /api/analytics/my-pins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

