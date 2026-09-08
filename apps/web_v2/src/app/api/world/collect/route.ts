import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

type CollectRpcRow = {
  placement_id: string;
  model_slug: string;
  reward: { type: string; amount?: number; key?: string; xp?: number } | null;
  wallet_balance: number | null;
  total_xp: number;
  level: number;
  highest_level_reached: number;
};

/**
 * POST /api/world/collect
 * Claims a collectible placement for the signed-in account: pays out its
 * reward, writes world.world_collections (per-account), grants XP, and
 * recomputes level — all atomically inside world.collect_placement().
 * Does NOT flip world_placements.visible; on_collect=remove is enforced
 * per-account at list time via world_list_placements.
 *
 * lat/lng are required — world.collect_placement enforces a 820 m proximity
 * check server-side and raises location_required / too_far_away on failure.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const VALID_KINDS = new Set(['collect', 'find', 'check_in', 'redeem']);

    const body = (await request.json().catch(() => null)) as
      | { placementId?: unknown; lat?: unknown; lng?: unknown; kind?: unknown }
      | null;
    const placementId = typeof body?.placementId === 'string' ? body.placementId : '';
    const lat = typeof body?.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
    const lng = typeof body?.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;
    const kind = typeof body?.kind === 'string' && VALID_KINDS.has(body.kind) ? body.kind : 'collect';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!placementId || !UUID_RE.test(placementId)) {
      // Placements the client just dropped still carry a `local-…` id until
      // POST /api/world/placements swaps it for the real uuid — nothing to
      // collect yet, so fail clean instead of round-tripping to Postgres.
      return NextResponse.json({ error: 'placement_not_found' }, { status: 404 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('world')
      .rpc('collect_placement', {
        p_placement_id: placementId,
        p_lat: lat,
        p_lng: lng,
        // Multi-account safe: without this the RPC fell back to an arbitrary
        // account owned by the user, so XP/hearts could land on the wrong one.
        p_account_id: session.accountId,
        // Discriminates collect vs find vs check_in in world_collections.kind.
        p_kind: kind,
      })
      .single<CollectRpcRow>();

    if (error) {
      const known: Record<string, number> = {
        placement_not_found: 404,
        placement_unavailable: 409,
        not_collectible: 400,
        already_collected: 409,
        location_required: 400,
        too_far_away: 400,
      };
      const status = known[error.message] ?? 500;
      if (status === 500 && process.env.NODE_ENV === 'development') {
        console.error('[world/collect]', error);
      }
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({
      ok: true,
      placementId: data.placement_id,
      modelSlug: data.model_slug,
      reward: data.reward,
      // tool_credits balance when reward.type === 'credits'; null for hearts/other
      walletBalance: data.wallet_balance,
      xp: { total: data.total_xp, level: data.level, highestLevelReached: data.highest_level_reached },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[world/collect]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
