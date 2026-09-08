import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

const VALID_SOURCES = new Set(['profile_card', 'direct', 'search', 'follow']);

/**
 * POST /api/community/profile/[id]/view
 * Logs a row in `community.profile_views` (anonymous ok). Skips self-views.
 * Trigger bumps `accounts.view_count` for non-self views.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { id: profileAccountId } = await ctx.params;
    if (!profileAccountId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    let source = 'profile_card';
    try {
      const body = (await req.json()) as { source?: string } | null;
      if (body?.source && VALID_SOURCES.has(body.source)) source = body.source;
    } catch {
      // No/invalid JSON — default source.
    }

    const session = await getSessionAccount();
    if (session?.accountId && session.accountId === profileAccountId) {
      const supabase = await createSupabaseServerClient();
      const { data: account } = await supabase
        .from('accounts')
        .select('view_count')
        .eq('id', profileAccountId)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        skipped: 'self',
        view_count: account?.view_count ?? null,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { error: insertError } = await supabase
      .schema('community')
      .from('profile_views')
      .insert({
        profile_account_id: profileAccountId,
        viewer_account_id: session?.accountId ?? null,
        source,
      });

    if (insertError) {
      console.error('[community/profile/view] insert', insertError);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('view_count')
      .eq('id', profileAccountId)
      .maybeSingle();

    return NextResponse.json({ ok: true, view_count: account?.view_count ?? null });
  } catch (e) {
    console.error('[community/profile/view]', e);
    return NextResponse.json({ ok: true });
  }
}
