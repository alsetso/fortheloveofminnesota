import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ code: string }> };

type PreviewResult = {
  code: string;
  title: string;
  description: string | null;
  rewards: RewardDescriptor[];
  expires_at: string | null;
};

export type RewardDescriptor = {
  type: string;
  amount?: number;
  item_id?: string;
  page_id?: string;
  zone_id?: string;
  duration_days?: number;
  label?: string;
};

/**
 * GET /api/referral-codes/[code]
 * Public — no auth required.
 * Returns reward preview for a code so the iOS modal can show what the player will get.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { code } = await params;
    if (!code || code.trim().length === 0) {
      return NextResponse.json({ error: 'code_not_found' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc('preview_referral_code', { p_code: code.trim().toUpperCase() })
      .single<PreviewResult>();

    if (error) {
      const known: Record<string, number> = {
        code_not_found: 404,
        code_expired: 410,
        code_maxed: 410,
      };
      return NextResponse.json(
        { error: error.message },
        { status: known[error.message] ?? 404 },
      );
    }

    return NextResponse.json(
      { preview: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[referral-codes/preview]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
