import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * GET /api/maps/public
 * Returns pins and mention_types from public schema. No map lookup.
 * For /maps page - public.map_pins + public.mention_types only.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());

    const [pinsRes, typesRes] = await Promise.all([
      supabase
        .from('map_pins')
        .select(`
          id,
          lat,
          lng,
          description,
          caption,
          emoji,
          image_url,
          video_url,
          account_id,
          mention_type_id,
          visibility,
          created_at,
          view_count,
          full_address,
          map_meta,
          tagged_account_ids
        `)
        .eq('visibility', 'public')
        .eq('is_active', true)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('mention_types')
        .select('id, emoji, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    const pins = pinsRes.data || [];
    const mentionTypes = typesRes.data || [];

    const accountIds = [...new Set(pins.map((p: any) => p.account_id).filter(Boolean))];
    let accounts: Record<string, any> = {};
    if (accountIds.length > 0) {
      const { data: accs } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name, image_url')
        .in('id', accountIds);
      accounts = (accs || []).reduce((a: any, c: any) => ({ ...a, [c.id]: c }), {});
    }

    const typeMap: Record<string, any> = {};
    mentionTypes.forEach((t: any) => { typeMap[t.id] = t; });

    const pinsWithJoins = pins.map((p: any) => ({
      ...p,
      account: p.account_id ? accounts[p.account_id] || null : null,
      mention_type: p.mention_type_id ? typeMap[p.mention_type_id] || null : null,
      map_id: p.map_id || null,
    }));

    return NextResponse.json({
      map: { id: 'public', name: 'Minnesota', slug: 'public' },
      pins: pinsWithJoins,
      mention_types: mentionTypes,
    });
  } catch (error) {
    console.error('[Maps Public API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public map data' },
      { status: 500 }
    );
  }
}
