import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * POST /api/location-searches
 * Save a location search (simple, non-blocking operation)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { place_name, coordinates, mapbox_data, search_query, page_source } = body;

    // Validate required fields
    if (!place_name || !coordinates?.lat || !coordinates?.lng || !mapbox_data) {
      return NextResponse.json(
        { error: 'Missing required fields: place_name, coordinates, mapbox_data' },
        { status: 400 }
      );
    }

    // Get user's account (optional)
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null; error: any };

    // Insert search record
    // Use location_searches table (simplified structure)
    const { error: insertError } = await supabase
      .from('location_searches')
      .insert({
        user_id: user.id,
        account_id: (account as { id: string } | null)?.id || null,
        place_name,
        lat: coordinates.lat,
        lng: coordinates.lng,
        mapbox_data,
        search_query: search_query || null,
        page_source: page_source || 'map',
      } as any);

    if (insertError) {
      console.error('Error saving location search:', insertError);
      // Still return success to not block the UI, but log the error
      return NextResponse.json({ success: false, error: insertError.message }, { status: 201 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Location search API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

