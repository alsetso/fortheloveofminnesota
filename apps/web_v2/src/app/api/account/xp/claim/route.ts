import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

/**
 * POST /api/account/xp/claim
 * Marks every pending XP transaction for the account as claimed and
 * recomputes the level state in one atomic RPC call.
 */
export async function POST() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc('claim_account_xp', { p_account_id: session.accountId })
      .single();

    if (error) {
      throw error;
    }

    const row = data as {
      claimed_count: number;
      claimed_amount: number;
      total_xp: number;
      level: number;
      highest_level_reached: number;
    };

    return NextResponse.json({
      ok: true,
      claimedCount: row.claimed_count,
      claimedAmount: row.claimed_amount,
      totalXp: row.total_xp,
      level: row.level,
      highestLevelReached: row.highest_level_reached,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/xp/claim]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
