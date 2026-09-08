import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referral-codes/mine
 * Returns all referral codes the signed-in account has redeemed, newest first.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('referral_code_uses' as never)
      .select(
        'id, used_at, status, rewards_granted, code:code_id(code, title, description)',
      )
      .eq('account_id', session.accountId)
      .eq('status', 'granted')
      .order('used_at', { ascending: false });

    if (error) {
      console.error('[referral-codes/mine]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ uses: data ?? [] });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[referral-codes/mine]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
