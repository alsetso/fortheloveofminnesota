import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/accounts/onboard
 * Sets onboarded + onboarding_completed_at on the signed-in accounts row.
 */
export async function POST() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('accounts')
      .update({
        onboarded: true,
        onboarding_completed_at: now,
      })
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .select('id, onboarded, onboarding_completed_at')
      .single();

    if (error || !data) {
      console.error('accounts onboard', error?.message);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      accountId: data.id,
      onboarded: data.onboarded === true,
    });
  } catch (err) {
    console.error('accounts onboard', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
