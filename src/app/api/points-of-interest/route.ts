import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Type assertion needed because TypeScript only allows 'public' schema,
    // but we need to query from 'map' schema
    const { data, error } = await (supabase as any)
      .schema('map')
      .from('points_of_interest')
      .select('id, name, category, emoji, lat, lng, description, created_at, updated_at')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching points of interest:', error);
      return NextResponse.json(
        { error: 'Failed to fetch points of interest', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      points: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/points-of-interest:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

