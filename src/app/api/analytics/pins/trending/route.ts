import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/pins/trending
 * Get trending pins based on view activity
 * Query params:
 *   - hours: Number of hours to look back (optional, default 24)
 *   - limit: Number of pins to return (optional, default 10)
 *   - min_views: Minimum views to be considered trending (optional, default 1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const minViews = parseInt(searchParams.get('min_views') || '1', 10);

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
          setAll() {},
        },
      }
    );

    // Get pins with view counts in the specified time range
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const { data: recentViews, error: viewsError } = await supabase
      .from('pin_views')
      .select('pin_id')
      .gte('viewed_at', cutoffTime.toISOString());

    if (viewsError) {
      console.error('Error fetching recent views:', viewsError);
      return NextResponse.json(
        { error: 'Failed to fetch trending pins', details: viewsError.message },
        { status: 500 }
      );
    }

    // Count views per pin
    const pinViewCounts: Record<string, number> = {};
    ((recentViews || []) as { pin_id: string }[]).forEach((view) => {
      pinViewCounts[view.pin_id] = (pinViewCounts[view.pin_id] || 0) + 1;
    });

    // Filter by minimum views and sort
    const trendingPins = Object.entries(pinViewCounts)
      .filter(([_, count]) => count >= minViews)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, limit)
      .map(([pinId, viewCount]) => ({ pin_id: pinId, view_count: viewCount }));

    // Fetch pin details (excluding archived)
    const pinIds = trendingPins.map((p) => p.pin_id);
    const { data: pins, error: pinsError } = await supabase
      .from('pins')
      .select('id, name, description, created_at, account_id')
      .in('id', pinIds)
      .eq('archived', false); // Exclude archived pins

    if (pinsError) {
      console.error('Error fetching pin details:', pinsError);
      return NextResponse.json(
        { error: 'Failed to fetch pin details', details: pinsError.message },
        { status: 500 }
      );
    }

    // Combine pin data with view counts
    const result = trendingPins.map((trending) => {
      const pin = (pins as { id: string; name: string | null; description: string | null; created_at: string; account_id: string }[] | null)?.find((p) => p.id === trending.pin_id);
      return {
        pin_id: trending.pin_id,
        view_count: trending.view_count,
        pin: pin || null,
      };
    });

    return NextResponse.json({
      trending: result,
      time_range_hours: hours,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in GET /api/analytics/pins/trending:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


