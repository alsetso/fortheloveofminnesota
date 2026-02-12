import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { getServerAuth } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClientWithAuth();
    const accountId = await getAccountIdForUser(auth, supabase);

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, username, view_count')
      .eq('id', accountId)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    type AccountRow = { id: string; username: string | null; view_count: number | null };
    const accountData = account as AccountRow;
    const username = accountData.username;

    // Get live map ID
    const { data: liveMap } = await supabase
      .schema('maps')
      .from('maps')
      .select('id')
      .eq('slug', 'live')
      .eq('is_active', true)
      .single();

    type LiveMapRow = { id: string };
    const liveMapId = (liveMap as LiveMapRow | null)?.id || null;

    // Get live mentions count (pins on live map)
    const { data: liveMentionsData, error: liveMentionsError } = await supabase
      .schema('maps')
      .from('pins')
      .select('id', { count: 'exact', head: false })
      .eq('map_id', liveMapId || '')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .eq('archived', false);

    const liveMentions = liveMentionsData?.length || 0;

    // Get all pin IDs for this account
    const { data: allPinsData } = await supabase
      .schema('maps')
      .from('pins')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .eq('archived', false);

    const mentionIds = (allPinsData || []).map((p: { id: string }) => p.id);

    // Helper: exclude self-views
    const nonSelfOrFilter = `account_id.is.null,account_id.neq.${accountId}`;

    // Count pin views using RPC function (analytics.events not directly accessible via PostgREST)
    let pinViews = 0;
    if (mentionIds.length > 0) {
      for (const batch of chunk(mentionIds, 200)) {
        const { data: count, error } = await supabase.rpc('count_entity_events', {
          p_entity_type: 'pin',
          p_entity_ids: batch,
          p_exclude_account_id: accountId,
        } as any) as { data: number | null; error: any };
        if (error) throw error;
        pinViews += count || 0;
      }
    }

    // Count mention page views (detail pages) - same as pin views (both are pins)
    let mentionPageViews = pinViews;

    // Profile views (already excludes self-views in view_count)
    const profileViews = accountData.view_count || 0;

    return NextResponse.json({
      liveMentions,
      profileViews,
      totalPinViews: pinViews,
      totalMentionViews: mentionPageViews,
    });
  } catch (error) {
    console.error('Error fetching account analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// Helper: chunk an array for batched IN queries
function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
