import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  isPrimaryTerritoryKind,
  dockKindToUnitKind,
} from '@/features/accountTerritories/store/constants';
import {
  PASSPORT_TERRITORY_KINDS,
  PASSPORT_TERRITORY_TOTALS,
  passportKindBarLabel,
} from '@/features/accountTerritories/store/passportKinds';
import { territoryKindLabel } from '@/features/xp/logic/xpSources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/passport
 * Unlocked-vs-total counts per jurisdiction kind (the "passport" progress
 * bars), plus the account's current level state.
 *
 * Kinds list = all product territory layers (Cities & towns featured in UI).
 * `unlockedTotal` stays CTU-only — the primary game score.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    const [presenceRes, levelRes, economyRes] = await Promise.all([
      supabase
        .from('account_territory_presence')
        .select('unit_kind, unit_id, first_seen_at')
        .eq('account_id', session.accountId)
        .order('first_seen_at', { ascending: false }),
      supabase
        .from('account_level_state')
        .select('total_xp, level, highest_level_reached')
        .eq('account_id', session.accountId)
        .maybeSingle(),
      supabase.rpc('game_economy_published' as never).maybeSingle(),
    ]);

    if (presenceRes.error) throw presenceRes.error;
    if (levelRes.error) throw levelRes.error;
    if (economyRes.error) throw economyRes.error;

    const economy = economyRes.data as {
      ceiling?: number;
      curve_exponent?: number;
      territory_xp_by_kind?: Record<string, number>;
    } | null;

    // Published rates, used as a fallback for any unlock predating the XP
    // ledger row (or if the transaction was ever purged) — real per-unlock
    // amounts (below) always win when a matching transaction exists.
    const rateByKind = economy?.territory_xp_by_kind ?? {};

    // Presence stores dock kinds (district, senate_district, house_district).
    // Keep dock kinds for passport bars; normalize only for XP ledger lookup.
    const presenceRows = presenceRes.data ?? [];

    const unlockedByKind = new Map<string, number>();
    for (const row of presenceRows) {
      const kind = row.unit_kind as string;
      unlockedByKind.set(kind, (unlockedByKind.get(kind) ?? 0) + 1);
    }

    const unitIds = [...new Set(presenceRows.map((r) => r.unit_id as string))];
    const nameById = new Map<string, string>();

    // Real per-unlock XP amount from the ledger (the source of truth) —
    // rates can change over time, so this reflects what was actually granted.
    // reference_type in the ledger also uses dock kinds — normalize to match.
    const xpByUnit = new Map<string, number>();
    if (unitIds.length > 0) {
      const { data: xpRows } = await supabase
        .from('account_xp_transactions')
        .select('reference_type, reference_id, amount')
        .eq('account_id', session.accountId)
        .eq('source_type', 'territory_unlock')
        .in('reference_id', unitIds);
      for (const row of xpRows ?? []) {
        if (row.reference_type && row.reference_id) {
          const dockKind = row.reference_type as string;
          const normalizedKind = dockKindToUnitKind(dockKind);
          xpByUnit.set(`${dockKind}:${row.reference_id}`, Number(row.amount) || 0);
          xpByUnit.set(`${normalizedKind}:${row.reference_id}`, Number(row.amount) || 0);
        }
      }
    }

    if (unitIds.length > 0) {
      // Batch in chunks — some passports can hold hundreds of unlocks.
      for (let i = 0; i < unitIds.length; i += 200) {
        const chunk = unitIds.slice(i, i + 200);
        const { data: units } = await supabase
          .schema('territory')
          .from('units')
          .select('id, name')
          .in('id', chunk);
        for (const u of units ?? []) {
          if (u.id && u.name) nameById.set(u.id as string, u.name as string);
        }
      }
    }

    const unlocked = presenceRows
      .map((row) => {
        const unitKind = row.unit_kind as string;
        const unitId = row.unit_id as string;
        const normalizedKind = dockKindToUnitKind(unitKind);
        return {
          unitKind,
          unitId,
          name: nameById.get(unitId) ?? territoryKindLabel(unitKind),
          firstSeenAt: row.first_seen_at as string,
          xpAmount:
            xpByUnit.get(`${unitKind}:${unitId}`) ??
            xpByUnit.get(`${normalizedKind}:${unitId}`) ??
            rateByKind[unitKind] ??
            rateByKind[normalizedKind] ??
            10,
        };
      })
      .filter((row) => Boolean(PASSPORT_TERRITORY_TOTALS[row.unitKind]));
    const recentlyUnlocked = unlocked.slice(0, 15);

    // unlockedTotal = CTU only (cities & towns, max 2,693).
    const unlockedTotal = unlocked.filter((u) => isPrimaryTerritoryKind(u.unitKind)).length;

    const kinds = PASSPORT_TERRITORY_KINDS.map((def) => ({
      unitKind: def.unitKind,
      label: passportKindBarLabel(def.unitKind),
      unlocked: unlockedByKind.get(def.unitKind) ?? 0,
      total: def.total,
    }));

    return NextResponse.json({
      kinds,
      unlocked,
      recentlyUnlocked,
      unlockedTotal,
      level: levelRes.data
        ? {
            totalXp: levelRes.data.total_xp,
            level: levelRes.data.level,
            highestLevelReached: levelRes.data.highest_level_reached,
          }
        : { totalXp: 0, level: 1, highestLevelReached: 1 },
      xpCeiling: Number(economy?.ceiling) > 0 ? Number(economy?.ceiling) : undefined,
      xpCurveExponent:
        Number(economy?.curve_exponent) > 0 ? Number(economy?.curve_exponent) : undefined,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/passport]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
