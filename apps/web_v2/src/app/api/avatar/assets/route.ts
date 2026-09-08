import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

/**
 * GET /api/avatar/assets
 * Returns all active avatar assets, each with an `owned` flag indicating
 * whether this account has unlocked it (via the ledger or default_unlock).
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createSupabaseServerClient();

    const [assetsRes, ownedRes] = await Promise.all([
      supabase
        .schema('world' as never)
        .from('avatar_assets')
        .select('id, slug, name, description, file_path, attach_point, real_world_meters, default_unlock, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .schema('world' as never)
        .from('account_avatar_assets')
        .select('asset_id')
        .eq('account_id', session.accountId),
    ]);

    if (assetsRes.error) throw assetsRes.error;

    const ownedIds = new Set((ownedRes.data ?? []).map(r => (r as { asset_id: string }).asset_id));

    const assets = (assetsRes.data ?? []).map(a => {
      const row = a as {
        id: string; slug: string; name: string; description: string | null;
        file_path: string; attach_point: string; real_world_meters: number | null;
        default_unlock: boolean; sort_order: number;
      };
      return {
        ...row,
        owned: row.default_unlock || ownedIds.has(row.id),
      };
    });

    return NextResponse.json({ assets });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[avatar/assets]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
