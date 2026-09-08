import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/accounts/state-verification
 * Persist Minnesota location check result (same contract as web settings).
 * Body: { state_verified: boolean }
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { state_verified?: unknown };
    try {
      body = (await req.json()) as { state_verified?: unknown };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (typeof body.state_verified !== 'boolean') {
      return NextResponse.json({ error: 'state_verified must be a boolean' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('accounts')
      .update({
        state_verified: body.state_verified,
        state_verification_checked_at: now,
      })
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .select('state_verified, state_verification_checked_at')
      .maybeSingle();

    if (error || !data) {
      console.error('state-verification', error?.message);
      return NextResponse.json({ error: 'Failed to update state verification' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('state-verification', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
