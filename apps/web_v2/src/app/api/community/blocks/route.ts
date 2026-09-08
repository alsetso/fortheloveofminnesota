import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/community/blocks — list blocked account ids for the session account.
 * POST { accountId } — block.
 * DELETE { accountId } — unblock.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('community')
      .from('account_blocks')
      .select('blocked_account_id')
      .eq('blocker_account_id', session.accountId);

    if (error) {
      console.error('[community/blocks] GET', error.message);
      return NextResponse.json({ error: 'Failed to load blocks' }, { status: 500 });
    }

    return NextResponse.json({
      blockedAccountIds: (data ?? []).map((r) => String(r.blocked_account_id)),
    });
  } catch (err) {
    console.error('[community/blocks] GET', err);
    return NextResponse.json({ error: 'Failed to load blocks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      accountId?: unknown;
    } | null;
    const accountId =
      typeof body?.accountId === 'string' ? body.accountId.trim() : '';
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    if (accountId === session.accountId) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.schema('community').from('account_blocks').upsert(
      {
        blocker_account_id: session.accountId,
        blocked_account_id: accountId,
      },
      {
        onConflict: 'blocker_account_id,blocked_account_id',
        ignoreDuplicates: true,
      },
    );

    if (error) {
      console.error('[community/blocks] POST', error.message);
      return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, blocked: true });
  } catch (err) {
    console.error('[community/blocks] POST', err);
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      accountId?: unknown;
    } | null;
    const accountId =
      typeof body?.accountId === 'string' ? body.accountId.trim() : '';
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema('community')
      .from('account_blocks')
      .delete()
      .eq('blocker_account_id', session.accountId)
      .eq('blocked_account_id', accountId);

    if (error) {
      console.error('[community/blocks] DELETE', error.message);
      return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, blocked: false });
  } catch (err) {
    console.error('[community/blocks] DELETE', err);
    return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
  }
}
