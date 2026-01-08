import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minLng = searchParams.get('minLng');
    const maxLng = searchParams.get('maxLng');
    const minLat = searchParams.get('minLat');
    const maxLat = searchParams.get('maxLat');
    
    const supabase = createServerClient();
    
    let query = (supabase as any)
      .schema('civic')
      .from('buildings')
      .select('id, type, name, description, lat, lng, full_address, website, cover_images, created_at, updated_at');
    
    // Apply bounding box filter if provided (spatial query)
    if (minLng && maxLng && minLat && maxLat) {
      query = query
        .gte('lng', parseFloat(minLng))
        .lte('lng', parseFloat(maxLng))
        .gte('lat', parseFloat(minLat))
        .lte('lat', parseFloat(maxLat));
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Civic Buildings API] Error fetching:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch buildings' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Civic Buildings API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

