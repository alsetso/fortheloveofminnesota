import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminHelpers';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    
    // Get bounding box from query params for spatial queries
    const { searchParams } = new URL(request.url);
    const minLng = searchParams.get('minLng');
    const maxLng = searchParams.get('maxLng');
    const minLat = searchParams.get('minLat');
    const maxLat = searchParams.get('maxLat');
    
    let query = (supabase as any)
      .schema('civic')
      .from('buildings')
      .select('*');
    
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
      console.error('[Admin Buildings API] Error fetching:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch buildings' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Admin Buildings API] Error:', error);
    
    // Check if it's an auth error
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    
    const supabase = createServiceClient();
    
    const { data, error } = await (supabase as any)
      .schema('civic')
      .from('buildings')
      .insert({
        type: body.type,
        name: body.name,
        description: body.description || null,
        lat: body.lat || null,
        lng: body.lng || null,
        full_address: body.full_address || null,
        website: body.website || null,
        cover_images: body.cover_images || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Admin Buildings API] Error creating:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create building' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[Admin Buildings API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

