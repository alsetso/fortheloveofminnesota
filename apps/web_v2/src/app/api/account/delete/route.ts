import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { assertUsernameMatches } from '@/lib/account/accountClosureShared';
import { permanentlyDeleteAccount } from '@/lib/account/permanentlyDeleteAccount';
import { getAccountClosureAftermath } from '@/lib/account/accountClosureAftermath';

/**
 * POST /api/account/delete
 * Permanently erases the account and owned data (auth user removed when last account).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
    const username = typeof body?.username === 'string' ? body.username : '';
    if (!username || username.length > 64) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, username, status, user_id')
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const usernameCheck = assertUsernameMatches(account.username, username);
    if (!usernameCheck.ok) {
      return NextResponse.json({ error: usernameCheck.error }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const { authUserRemoved } = await permanentlyDeleteAccount(
      service,
      session.accountId,
      account.user_id,
    );

    const aftermath = await getAccountClosureAftermath(
      service,
      account.user_id,
      session.accountId,
      { authUserRemoved },
    );

    return NextResponse.json({
      ok: true,
      deleted: true,
      remainingAccountCount: aftermath.remainingAccountCount,
      suggestedNextAccountId: aftermath.suggestedNextAccountId,
      authUserRemoved: aftermath.authUserRemoved,
    });
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'Failed to delete account';
    console.error('[account/delete]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
