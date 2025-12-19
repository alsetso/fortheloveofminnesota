import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/map-pins/search
 * Fuzzy search map_pins by description
 * Query param: q (search query string)
 */
export async function GET(request: NextRequest) {
  try {
    const response = new NextResponse();
    const cookieStore = await cookies();
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ pins: [] }, { status: 200 });
    }

    // Use PostgreSQL's ILIKE for case-insensitive fuzzy matching
    const searchTerm = query.trim();
    
    // Build query with ILIKE for fuzzy matching
    // Try to join accounts - may fail for anonymous users due to RLS, handle gracefully
    let dbQuery = supabase
      .from('pins')
      .select(`
        id,
        lat,
        lng,
        description,
        media_url,
        account_id,
        visibility,
        created_at,
        view_count,
        accounts!pins_account_id_fkey(
          id,
          username,
          image_url
        )
      `)
      .not('description', 'is', null)
      .ilike('description', `%${searchTerm}%`)
      .limit(20);

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching map pins:', error);
      return NextResponse.json(
        { error: 'Failed to search pins', details: error.message },
        { status: 500, headers: response.headers }
      );
    }

    // Transform the nested account data to match our interface
    const pins = (data || []).map((pin: any) => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      description: pin.description,
      media_url: pin.media_url,
      account_id: pin.account_id,
      visibility: pin.visibility || 'public',
      created_at: pin.created_at,
      view_count: pin.view_count || null,
      account: pin.accounts ? {
        id: pin.accounts.id,
        username: pin.accounts.username,
        image_url: pin.accounts.image_url,
      } : null,
    }));

    return NextResponse.json({ pins }, { status: 200, headers: response.headers });
  } catch (error) {
    console.error('Map pins search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


