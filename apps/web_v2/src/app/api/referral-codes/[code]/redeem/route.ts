import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ code: string }> };

type RedeemResult = {
  ok: boolean;
  code: string;
  title: string;
  description: string | null;
  rewards: unknown[];
  xp_granted: number;
  credits_granted: number;
  level: number;
  total_xp: number;
};

/**
 * POST /api/referral-codes/[code]/redeem
 * Authenticated — requires a signed-in account.
 * Atomically redeems the code: validates, grants XP + credits, records use.
 * Throws descriptive errors the iOS modal surfaces directly.
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in to redeem a referral code.' }, { status: 401 });
    }

    const { code } = await params;
    if (!code || code.trim().length === 0) {
      return NextResponse.json({ error: 'code_not_found' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc('redeem_referral_code', {
        p_code: code.trim().toUpperCase(),
        p_account_id: session.accountId,
      })
      .single<RedeemResult>();

    if (error) {
      const userMessages: Record<string, string> = {
        code_not_found:    "That code doesn't exist — check your spelling.",
        code_expired:      'This code has expired.',
        code_maxed:        'This code has been fully claimed.',
        already_redeemed:  "You've already used this code.",
      };
      const httpStatus: Record<string, number> = {
        code_not_found:   404,
        code_expired:     410,
        code_maxed:       410,
        already_redeemed: 409,
      };
      const msg = userMessages[error.message] ?? "That code isn't valid or has already been used.";
      return NextResponse.json(
        { error: msg },
        { status: httpStatus[error.message] ?? 400 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[referral-codes/redeem]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
