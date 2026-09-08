import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PinRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
};

/**
 * GET /api/community/pins/mine
 * Current account's public/active map pins for the Community pins dock card.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await supabase
      .schema('community')
      .from('posts')
      .select(
        'id, lat, lng, body, emoji, full_address, created_at, like_count, comment_count, view_count',
      )
      .eq('kind', 'post')
      .eq('account_id', session.accountId)
      .eq('is_active', true)
      .eq('archived', false)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[community/pins/mine]', error);
      return NextResponse.json({ error: 'Failed to load pins' }, { status: 500 });
    }

    const pins = ((rows ?? []) as PinRow[]).map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      body: p.body,
      emoji: p.emoji,
      full_address: p.full_address,
      created_at: p.created_at,
      like_count: p.like_count ?? 0,
      comment_count: p.comment_count ?? 0,
      view_count: p.view_count ?? 0,
    }));

    return NextResponse.json(
      { pins },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/pins/mine]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
