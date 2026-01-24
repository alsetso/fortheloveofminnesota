import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const auth = await getServerAuth();
    let accountId: string | null = null;
    
    if (auth) {
      const supabaseWithAuth = await createServerClientWithAuth();
      accountId = await getAccountIdForUser(auth, supabaseWithAuth);
    }

    // Check if user is authenticated
    const isAuthenticated = !!accountId;

    // Build query with relations
    const query = supabase
      .from('mentions')
      .select(`
        id,
        lat,
        lng,
        description,
        image_url,
        video_url,
        media_type,
        account_id,
        collection_id,
        mention_type_id,
        visibility,
        archived,
        post_date,
        created_at,
        updated_at,
        view_count,
        full_address,
        map_meta,
        accounts(
          id,
          username,
          first_name,
          image_url,
          plan
        ),
        collections(
          id,
          emoji,
          title
        ),
        mention_type:mention_types(
          id,
          emoji,
          name
        )
      `)
      .eq('id', id)
      .eq('archived', false)
      .single();

    // For anonymous users, filter to public only
    if (!isAuthenticated) {
      query.eq('visibility', 'public');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Mention not found' },
        { status: 404 }
      );
    }

    // Transform to match frontend expectations
    const mention = {
      ...data,
      account: data.accounts,
      collection: data.collections,
    };

    // Cache headers (5 minutes for public mentions)
    const headers = new Headers();
    if (data.visibility === 'public') {
      headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    }

    return NextResponse.json({ mention }, { headers });
  } catch (error) {
    console.error('[API] Error fetching mention:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
