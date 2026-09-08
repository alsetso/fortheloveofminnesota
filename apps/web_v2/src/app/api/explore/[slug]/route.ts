import { NextResponse } from 'next/server';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { EXPLORE_LAYER_SLUGS } from '@/features/map/territory/territoryLayers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/explore/[slug]?offset=0&limit=50&q=
 *
 * Territory kind page data — all units + user unlock state.
 *
 * Tier A (cities-and-towns, counties): paginated full list, unlocked flag per row.
 * Tier B (school-districts, districts, senate-districts, house-districts):
 *   only the user's unlocked units + total count (no giant list).
 *
 * Auth optional — unlocked flags are omitted for anon callers.
 */

const TIER_A = new Set(['cities-and-towns', 'counties']);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!EXPLORE_LAYER_SLUGS.includes(slug as (typeof EXPLORE_LAYER_SLUGS)[number])) {
      return NextResponse.json({ error: 'Unknown layer' }, { status: 404 });
    }

    const config = getTerritoryLayer(slug);
    if (!config) {
      return NextResponse.json({ error: 'Unknown layer' }, { status: 404 });
    }

    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const q = (url.searchParams.get('q') ?? '').trim();

    const session = await getSessionAccount().catch(() => null);
    const accountId = session?.accountId ?? null;

    const db = createTerritoryServerClient();
    const supabase = await createSupabaseServerClient();

    // Fetch user's unlocked units for this kind (if signed in).
    const unlockedIds = new Set<string>();
    const xpByUnitId = new Map<string, number>();

    if (accountId) {
      const { data: presence } = await supabase
        .from('account_territory_presence')
        .select('unit_id')
        .eq('account_id', accountId)
        .eq('unit_kind', config.entityKind);

      for (const row of presence ?? []) {
        if (row.unit_id) unlockedIds.add(row.unit_id as string);
      }

      // Fetch real XP amounts from the ledger.
      if (unlockedIds.size > 0) {
        const { data: xpRows } = await supabase
          .from('account_xp_transactions')
          .select('reference_id, amount')
          .eq('account_id', accountId)
          .eq('source_type', 'territory_unlock')
          .in('reference_id', [...unlockedIds]);
        for (const row of xpRows ?? []) {
          if (row.reference_id) xpByUnitId.set(row.reference_id as string, Number(row.amount) || 0);
        }
      }
    }

    const isTierA = TIER_A.has(slug);

    if (isTierA) {
      // Full paginated list — every unit, unlocked flag stamped on each row.
      let query = db
        .from(config.table)
        .select(config.selectColumns, { count: 'exact' })
        .order(config.nameColumn, { ascending: true });

      if (q.length >= 2) {
        const escaped = q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
        query = query.ilike(config.nameColumn, `%${escaped}%`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      const rows = (data ?? []).map((row) => {
        const r = row as unknown as Record<string, unknown>;
        return {
          ...r,
          unlocked: unlockedIds.has(String(r.id ?? '')),
          xpAmount: xpByUnitId.get(String(r.id ?? '')) ?? null,
        };
      });

      return NextResponse.json({
        slug,
        tier: 'a',
        entityKind: config.entityKind,
        label: config.label,
        subtitle: config.subtitle,
        rows,
        total: count ?? 0,
        unlockedTotal: unlockedIds.size,
        offset,
        limit,
      });
    }

    // Tier B — return only the user's unlocked units + total count for the kind.
    // Fetch total from territory.units.
    const { count: totalCount } = await db
      .from(config.table)
      .select('id', { count: 'exact', head: true });

    if (unlockedIds.size === 0) {
      return NextResponse.json({
        slug,
        tier: 'b',
        entityKind: config.entityKind,
        label: config.label,
        subtitle: config.subtitle,
        rows: [],
        total: totalCount ?? 0,
        unlockedTotal: 0,
        offset: 0,
        limit,
      });
    }

    // Fetch names for the user's unlocked units.
    const { data: unlockedData } = await db
      .from(config.table)
      .select(config.selectColumns)
      .in('id', [...unlockedIds])
      .order(config.nameColumn, { ascending: true });

    const rows = (unlockedData ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        ...r,
        unlocked: true,
        xpAmount: xpByUnitId.get(String(r.id ?? '')) ?? null,
      };
    });

    return NextResponse.json({
      slug,
      tier: 'b',
      entityKind: config.entityKind,
      label: config.label,
      subtitle: config.subtitle,
      rows,
      total: totalCount ?? 0,
      unlockedTotal: unlockedIds.size,
      offset: 0,
      limit,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[explore slug]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
