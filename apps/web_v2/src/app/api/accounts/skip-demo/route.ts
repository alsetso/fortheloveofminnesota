import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/accounts/skip-demo
 * Sets skipped_demo = true for the current account.
 * Idempotent — safe to call multiple times.
 */
export async function POST() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('accounts')
      .update({ skipped_demo: true })
      .eq('id', session.accountId)
      .eq('user_id', session.userId);

    if (error) {
      console.error('skip-demo update', error.message);
      return NextResponse.json({ error: 'Failed to skip demo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('skip-demo', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
