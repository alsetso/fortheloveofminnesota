import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Coarse presence — skip writes when last_visit is fresher than this. */
const TOUCH_THROTTLE_MS = 60 * 60 * 1000;

/**
 * POST /api/accounts/touch
 * Bumps `accounts.last_visit` for the signed-in account (max once / hour).
 */
export async function POST() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: row, error: readErr } = await supabase
      .from('accounts')
      .select('last_visit')
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (readErr) {
      console.error('[accounts/touch] read', readErr.message);
      return NextResponse.json({ error: 'Failed to touch' }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const last = row.last_visit ? new Date(String(row.last_visit)).getTime() : 0;
    if (Number.isFinite(last) && Date.now() - last < TOUCH_THROTTLE_MS) {
      return new NextResponse(null, { status: 204 });
    }

    const { error: writeErr } = await supabase
      .from('accounts')
      .update({ last_visit: new Date().toISOString() })
      .eq('id', session.accountId)
      .eq('user_id', session.userId);

    if (writeErr) {
      console.error('[accounts/touch] write', writeErr.message);
      return NextResponse.json({ error: 'Failed to touch' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[accounts/touch]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
