import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/pin-stats
 * Returns view statistics for a mention (formerly pin)
 * Note: Parameter name is "pin_id" for backward compatibility, but it's actually a mention ID
 * 
 * Query params:
 * - pin_id: UUID of the mention
 * - hours: Optional number of hours to filter (default: all time)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pinId = searchParams.get('pin_id');
    const hoursParam = searchParams.get('hours');

    if (!pinId) {
      return NextResponse.json(
        { error: 'pin_id query parameter is required' },
        { status: 400 }
      );
    }

    const hours = hoursParam ? parseInt(hoursParam, 10) : null;
    if (hoursParam && (isNaN(hours!) || hours! < 0)) {
      return NextResponse.json(
        { error: 'hours must be a positive integer' },
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
            // Route handlers can set cookies - no-op for read operations
          },
        },
      }
    );

    // Get stats using get_pin_stats function
    // Note: pin_id is actually a mention ID (legacy naming)
    const { data, error } = await supabase.rpc('get_pin_stats', {
      p_pin_id: pinId,
      p_hours: hours,
    } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

    if (error) {
      console.error('Error fetching mention stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch mention stats', details: error.message },
        { status: 500 }
      );
    }

    // Function returns array with single row
    const stats = data && data.length > 0 ? data[0] : {
      total_views: 0,
      unique_viewers: 0,
      accounts_viewed: 0,
    };

    return NextResponse.json({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/pin-stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


