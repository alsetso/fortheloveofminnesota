import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * GET /api/maps/public/pins
 * Returns pins from public.map_pins. Same shape as live/pins for MentionsLayer compatibility.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());

    const typeParam = request.nextUrl.searchParams.get('type');
    const typesParam = request.nextUrl.searchParams.get('types');
    const slugParam = typesParam || typeParam;
    let mentionTypeIds: string[] | undefined;
    if (slugParam) {
      const slugs = slugParam.split(',').map((s) => s.trim()).filter(Boolean);
      const { data: types } = await supabase
        .from('mention_types')
        .select('id, name')
        .eq('is_active', true);
      const slugToId = (name: string) =>
        name.toLowerCase().replace(/\s*&\s*/g, '-and-').replace(/[()]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const ids = (types || [])
        .filter((t: any) => slugs.includes(slugToId(t.name)))
        .map((t: any) => t.id);
      if (ids.length > 0) mentionTypeIds = ids;
    }

    let query = supabase
      .from('map_pins')
      .select(`
        id,
        map_id,
        lat,
        lng,
        description,
        caption,
        emoji,
        image_url,
        video_url,
        icon_url,
        media_type,
        full_address,
        map_meta,
        view_count,
        tagged_account_ids,
        visibility,
        archived,
        post_date,
        created_at,
        updated_at,
        account_id,
        mention_type_id
      `)
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(500);

    if (mentionTypeIds && mentionTypeIds.length > 0) {
      query = query.in('mention_type_id', mentionTypeIds);
    }

    const { data: pins, error } = await query;

    if (error) {
      console.error('[Maps Public Pins API] Error:', error);
      return NextResponse.json({ pins: [] });
    }

    const typeIds = [...new Set((pins || []).map((p: any) => p.mention_type_id).filter(Boolean))];
    const accountIds = [...new Set((pins || []).map((p: any) => p.account_id).filter(Boolean))];

    let mentionTypes: Record<string, any> = {};
    let accounts: Record<string, any> = {};

    if (typeIds.length > 0) {
      const { data: types } = await supabase
        .from('mention_types')
        .select('id, emoji, name')
        .in('id', typeIds);
      mentionTypes = (types || []).reduce((a: any, c: any) => ({ ...a, [c.id]: c }), {});
    }
    if (accountIds.length > 0) {
      const { data: accs } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name, image_url')
        .in('id', accountIds);
      accounts = (accs || []).reduce((a: any, c: any) => ({ ...a, [c.id]: c }), {});
    }

    const formatted = (pins || []).map((p: any) => ({
      id: p.id,
      map_id: p.map_id,
      lat: p.lat ?? 0,
      lng: p.lng ?? 0,
      description: p.description || p.caption || null,
      caption: p.caption || null,
      emoji: p.emoji || null,
      image_url: p.image_url || null,
      video_url: p.video_url || null,
      account_id: p.account_id || null,
      created_at: p.created_at,
      account: p.account_id ? accounts[p.account_id] || null : null,
      mention_type: p.mention_type_id ? mentionTypes[p.mention_type_id] || null : null,
      tagged_account_ids: p.tagged_account_ids || [],
    }));

    return NextResponse.json({ pins: formatted });
  } catch (error) {
    console.error('[Maps Public Pins API] Error:', error);
    return NextResponse.json({ pins: [] });
  }
}
