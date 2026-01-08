import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('building_id');
    const upcoming = searchParams.get('upcoming') === 'true';

    const supabase = createServerClient();
    
    let query = (supabase as any)
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }

    if (upcoming) {
      const now = new Date().toISOString();
      query = query.gte('start_date', now);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Civic Events API] Error fetching:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch events' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Civic Events API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

