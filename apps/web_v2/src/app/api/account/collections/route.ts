import { NextResponse } from 'next/server';
import {
  createServiceRoleClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

const HEART_SLUG = 'heart-quaternius';

type CollectionRow = {
  id: string;
  placement_id: string;
  reward: { type: string; amount?: number; key?: string; xp?: number } | null;
  collected_at: string;
  world_models: { name: string; slug: string; file_path: string } | null;
};

type ModelRow = {
  id: string;
  slug: string;
  name: string;
  file_path: string;
  rare: boolean;
  reward: { type?: string; amount?: number; key?: string; item?: string; xp?: number } | null;
};

type PlacementCountRow = {
  model_id: string;
  visible: boolean;
  total_available: number | null;
};

/** Territories → placements only (no FK from territories → world_models). */
type CtuTerritoryPlacementRow = {
  placement_id: string;
  world_placements: { visible: boolean; model_id: string } | null;
};

const EMPTY_HEARTS_IN_CTUS = {
  available: 0,
  collected: 0,
  /** Visible hearts in unlocked CTUs not yet claimed by this account. */
  remaining: 0,
  /** Visible hearts outside unlocked CTUs (need new cities to reach). */
  remainingOutside: 0,
  unlockedCtuCount: 0,
};

/**
 * GET /api/account/collections
 * Collections card + Today progress: personal counts vs visible map totals
 * per collectible model (e.g. "3 of 11 hearts on the map").
 * Rare models (credits, chests) stay off the list until the account has
 * collected at least one — they still appear on the map for claim.
 * Also returns hearts scoped to unlocked city/town (CTU) territories.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service-role client for world schema — auth is enforced at the route level
    // via getSessionAccount(); we scope rows explicitly (.eq account_id / active).
    // This avoids PostgREST schema-exposure requirements and gives accurate stock
    // counts across all placements (not just the ones RLS would surface).
    const world = createServiceRoleClient('world');
    const supabase = await createSupabaseServerClient();

    const [collectionsRes, modelsRes, unlockedCtuRes] = await Promise.all([
      world
        .from('world_collections')
        .select('id, placement_id, reward, collected_at, world_models(name, slug, file_path)')
        .eq('account_id', session.accountId)
        .order('collected_at', { ascending: false })
        .limit(500)
        .overrideTypes<CollectionRow[]>(),
      world
        .from('world_models')
        .select('id, slug, name, file_path, rare, reward')
        .eq('active', true)
        .eq('interaction', 'collect')
        .overrideTypes<ModelRow[]>(),
      supabase
        .from('account_territory_presence')
        .select('unit_id')
        .eq('account_id', session.accountId)
        .eq('unit_kind', 'ctu'),
    ]);

    if (collectionsRes.error) throw collectionsRes.error;
    if (modelsRes.error) throw modelsRes.error;
    if (unlockedCtuRes.error) throw unlockedCtuRes.error;

    const rows = collectionsRes.data ?? [];
    const models = modelsRes.data ?? [];
    const modelIds = models.map((m) => m.id);
    const unlockedCtuIds = (unlockedCtuRes.data ?? [])
      .map((row) => String((row as { unit_id: string }).unit_id))
      .filter(Boolean);
    const heartModelId = models.find((m) => m.slug === HEART_SLUG)?.id ?? null;

    /** Visible placements — common collectibles (hearts) still on the map. */
    const visibleByModelId = new Map<string, number>();
    /** All placements / claim slots — rare stock doesn't shrink out of the denominator. */
    const stockByModelId = new Map<string, number>();
    if (modelIds.length > 0) {
      const { data: placementRows, error: placementErr } = await world
        .from('world_placements')
        .select('model_id, visible, total_available')
        .in('model_id', modelIds)
        .overrideTypes<PlacementCountRow[]>();
      if (placementErr) throw placementErr;
      for (const row of placementRows ?? []) {
        if (row.visible) {
          visibleByModelId.set(row.model_id, (visibleByModelId.get(row.model_id) ?? 0) + 1);
        }
        const slots =
          row.total_available != null && row.total_available > 0
            ? row.total_available
            : 1;
        stockByModelId.set(row.model_id, (stockByModelId.get(row.model_id) ?? 0) + slots);
      }
    }

    const collectedBySlug = new Map<string, number>();
    const since24h = Date.now() - 24 * 60 * 60 * 1000;
    let findsLast24h = 0;
    for (const row of rows) {
      const collectedAt = row.collected_at ? new Date(row.collected_at).getTime() : NaN;
      if (Number.isFinite(collectedAt) && collectedAt >= since24h) {
        findsLast24h += 1;
      }
      const slug = row.world_models?.slug;
      if (!slug) continue;
      collectedBySlug.set(slug, (collectedBySlug.get(slug) ?? 0) + 1);
    }

    const byModel = models
      .map((m) => {
        const count = collectedBySlug.get(m.slug) ?? 0;
        const rare = Boolean(m.rare);
        // Rares leave the map when claimed — use full stock so progress stays 1/N not 5/1.
        const availableTotal = rare
          ? (stockByModelId.get(m.id) ?? 0)
          : (visibleByModelId.get(m.id) ?? 0);
        const xp = Number(m.reward?.xp);
        return {
          slug: m.slug,
          name: m.name,
          filePath: m.file_path,
          rare,
          count,
          availableTotal,
          remaining: Math.max(0, availableTotal - count),
          xp: Number.isFinite(xp) && xp > 0 ? xp : 0,
        };
      })
      // Rare finds stay hidden until the account has claimed ≥1.
      .filter((m) => !m.rare || m.count > 0)
      // Hearts first, then closest-to-complete, then name.
      .sort((a, b) => {
        if (a.slug === HEART_SLUG && b.slug !== HEART_SLUG) return -1;
        if (b.slug === HEART_SLUG && a.slug !== HEART_SLUG) return 1;
        const aPct = a.availableTotal > 0 ? a.count / a.availableTotal : 0;
        const bPct = b.availableTotal > 0 ? b.count / b.availableTotal : 0;
        if (bPct !== aPct) return bPct - aPct;
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

    const availableTotal = byModel.reduce((sum, m) => sum + m.availableTotal, 0);
    const heartModel = byModel.find((m) => m.slug === HEART_SLUG);

    const statewideVisibleHearts = heartModel?.availableTotal ?? 0;

    /** Hearts available / collected inside unlocked CTUs (cities & towns). */
    let heartsInUnlockedCtus = {
      ...EMPTY_HEARTS_IN_CTUS,
      unlockedCtuCount: unlockedCtuIds.length,
      // No unlocked cities yet → everything still on the map is "outside".
      remainingOutside: statewideVisibleHearts,
    };
    if (heartModelId && unlockedCtuIds.length > 0) {
      try {
        /** Any heart placement in unlocked CTUs (incl. already-claimed / hidden). */
        const heartPlacementIdsInCtus = new Set<string>();
        /** Still-visible subset — "hearts left to find" in those cities. */
        const visibleHeartPlacementIdsInCtus = new Set<string>();
        const CHUNK = 100;
        for (let i = 0; i < unlockedCtuIds.length; i += CHUNK) {
          const chunk = unlockedCtuIds.slice(i, i + CHUNK);
          const { data: territoryRows, error: territoryErr } = await world
            .from('world_placement_territories')
            .select('placement_id, world_placements(visible, model_id)')
            .eq('unit_kind', 'ctu')
            .in('unit_id', chunk)
            .overrideTypes<CtuTerritoryPlacementRow[]>();
          if (territoryErr) throw territoryErr;
          for (const row of territoryRows ?? []) {
            if (!row.placement_id || !row.world_placements) continue;
            if (row.world_placements.model_id !== heartModelId) continue;
            heartPlacementIdsInCtus.add(row.placement_id);
            if (row.world_placements.visible) {
              visibleHeartPlacementIdsInCtus.add(row.placement_id);
            }
          }
        }

        const collectedPlacementIds = new Set<string>();
        let collectedInCtus = 0;
        for (const row of rows) {
          if (row.world_models?.slug !== HEART_SLUG) continue;
          collectedPlacementIds.add(row.placement_id);
          if (heartPlacementIdsInCtus.has(row.placement_id)) collectedInCtus += 1;
        }

        let remainingInCtus = 0;
        for (const placementId of visibleHeartPlacementIdsInCtus) {
          if (!collectedPlacementIds.has(placementId)) remainingInCtus += 1;
        }

        const availableInCtus = visibleHeartPlacementIdsInCtus.size;
        heartsInUnlockedCtus = {
          available: availableInCtus,
          collected: collectedInCtus,
          // Claimable without leaving unlocked cities — not available − collected
          // (collected includes hearts already removed from the map).
          remaining: remainingInCtus,
          // Visible statewide stock not sitting in an unlocked city.
          remainingOutside: Math.max(0, statewideVisibleHearts - availableInCtus),
          unlockedCtuCount: unlockedCtuIds.length,
        };
      } catch (ctuErr) {
        // Keep statewide hearts; CTU scoped stats fall back to zeros / all-outside.
        if (process.env.NODE_ENV === 'development') {
          console.error('[account/collections] heartsInUnlockedCtus', ctuErr);
        }
      }
    }

    return NextResponse.json({
      total: rows.length,
      findsLast24h,
      availableTotal,
      hearts: {
        collected: heartModel?.count ?? 0,
        available: heartModel?.availableTotal ?? 0,
        remaining: heartModel?.remaining ?? 0,
      },
      heartsInUnlockedCtus,
      byModel,
      recent: rows.slice(0, 20).map((row) => ({
        id: row.id,
        placementId: row.placement_id,
        reward: row.reward,
        collectedAt: row.collected_at,
        /** kind column not yet on world_collections — default to 'collect'. */
        kind: 'collect',
        model: row.world_models
          ? { slug: row.world_models.slug, name: row.world_models.name }
          : null,
      })),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/collections]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
