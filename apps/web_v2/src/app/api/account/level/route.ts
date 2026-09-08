import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { xpSourceLabel, territoryKindLabel } from '@/features/xp/logic/xpSources';
import {
  levelFromXp,
  progressInLevel,
  xpThresholdForLevel,
} from '@/features/xp/logic/xpCurve';

export const dynamic = 'force-dynamic';

// Fallback kind labels for territory_unlock rows whose unit name lookup misses.
// Senate/house are stored as `legislative` in territory.units unit_kind.
function kindLabel(kind: string): string {
  return territoryKindLabel(kind);
}

function sourceLabel(sourceType: string): string {
  return xpSourceLabel(sourceType);
}

/**
 * GET /api/account/level
 * Level card data: current level + XP bar to the next level, plus a
 * breakdown of where XP came from — powers "why is my level going up".
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    const [levelRes, xpRes, recentRes, economyRes] = await Promise.all([
      supabase
        .from('account_level_state')
        .select('total_xp, level, highest_level_reached, updated_at')
        .eq('account_id', session.accountId)
        .maybeSingle(),
      // Breakdown + recent activity mirror total_xp, which only sums claimed
      // rows — unclaimed XP lives exclusively in the claim modal / overlay
      // until the account confirms it.
      supabase
        .from('account_xp_transactions')
        .select('source_type, amount, claimed_at')
        .eq('account_id', session.accountId)
        .not('claimed_at', 'is', null),
      supabase
        .from('account_xp_transactions')
        .select('id, source_type, amount, reference_type, reference_id, created_at, claimed_at')
        .eq('account_id', session.accountId)
        .not('claimed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase.rpc('game_economy_published' as never).maybeSingle(),
    ]);

    if (levelRes.error) throw levelRes.error;
    if (xpRes.error) throw xpRes.error;
    if (recentRes.error) throw recentRes.error;
    if (economyRes.error) throw economyRes.error;

    const economy = economyRes.data as { ceiling?: number; curve_exponent?: number } | null;
    let totalXp = levelRes.data?.total_xp ?? 0;
    let level = levelRes.data?.level ?? 1;
    let highestLevelReached = levelRes.data?.highest_level_reached ?? level;
    const ceilingRaw = Number(economy?.ceiling);
    const ceiling = Number.isFinite(ceilingRaw) && ceilingRaw > 0 ? ceilingRaw : 1;
    const curveRaw = Number(economy?.curve_exponent);
    const curveExponent = Number.isFinite(curveRaw) && curveRaw > 0 ? curveRaw : 1;

    // Heal stale level rows (total_xp advanced without recompute). Same formula
    // as public.recompute_account_level / client xpCurve.levelFromXp.
    const derivedLevel = levelFromXp(totalXp, ceiling, curveExponent);
    if (derivedLevel > level) {
      const { data: healed, error: healErr } = await supabase.rpc(
        'recompute_account_level',
        { p_account_id: session.accountId },
      );
      if (!healErr && healed) {
        const row = Array.isArray(healed) ? healed[0] : healed;
        totalXp = Number((row as { total_xp?: number })?.total_xp) || totalXp;
        level = Number((row as { level?: number })?.level) || derivedLevel;
        highestLevelReached =
          Number((row as { highest_level_reached?: number })?.highest_level_reached) ||
          Math.max(highestLevelReached, level);
      } else {
        level = derivedLevel;
        highestLevelReached = Math.max(highestLevelReached, level);
      }
    }

    // Shared ceil-threshold curve — same as public profile standing + xpCurve.
    const xpForCurrentLevel = xpThresholdForLevel(level, ceiling, curveExponent);
    const xpForNextLevel =
      level >= 99
        ? xpForCurrentLevel
        : xpThresholdForLevel(level + 1, ceiling, curveExponent);
    const progressPct = progressInLevel(totalXp, level, ceiling, curveExponent);
    const nowMs = Date.now();
    const since24h = nowMs - 24 * 60 * 60 * 1000;
    const bySource = new Map<string, number>();
    const bySourceLast24h = new Map<string, number>();
    let xpLast24h = 0;
    for (const row of xpRes.data ?? []) {
      const amount = Number(row.amount) || 0;
      const sourceType = String(row.source_type ?? '');
      bySource.set(sourceType, (bySource.get(sourceType) ?? 0) + amount);
      const claimedAt = row.claimed_at ? new Date(row.claimed_at as string).getTime() : NaN;
      if (Number.isFinite(claimedAt) && claimedAt >= since24h) {
        xpLast24h += amount;
        bySourceLast24h.set(sourceType, (bySourceLast24h.get(sourceType) ?? 0) + amount);
      }
    }
    const toBreakdown = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([sourceType, xp]) => ({ sourceType, label: sourceLabel(sourceType), xp }))
        .sort((a, b) => b.xp - a.xp);
    const breakdown = toBreakdown(bySource);
    const breakdownLast24h = toBreakdown(bySourceLast24h);

    const recentRows = recentRes.data ?? [];
    const territoryIds = [
      ...new Set(
        recentRows
          .filter((r) => r.source_type === 'territory_unlock' && r.reference_id)
          .map((r) => r.reference_id as string),
      ),
    ];
    const nameById = new Map<string, string>();
    if (territoryIds.length > 0) {
      const { data: units } = await supabase
        .schema('territory')
        .from('units')
        .select('id, name')
        .in('id', territoryIds);
      for (const u of units ?? []) {
        if (u.id && u.name) nameById.set(u.id as string, u.name as string);
      }
    }

    const recentActivity = recentRows.map((row) => {
        const referenceType = (row.reference_type as string | null) ?? null;
        const referenceId = (row.reference_id as string | null) ?? null;
        const sourceType = String(row.source_type ?? '');
        let name = sourceLabel(sourceType);
        if (sourceType === 'territory_unlock' && referenceId) {
          name = nameById.get(referenceId) ?? kindLabel(referenceType ?? '') ?? 'Area';
        } else if (sourceType === 'daily_streak' && row.created_at) {
          const when = new Date(row.created_at as string).toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            month: 'short',
            day: 'numeric',
          });
          name = `Daily streak · ${when}`;
        }
        return {
          id: row.id as string,
          amount: Number(row.amount) || 0,
          sourceType,
          label: sourceLabel(sourceType),
          name,
          referenceType,
          referenceId,
          createdAt: row.created_at as string,
          claimedAt: (row.claimed_at as string | null) ?? null,
        };
      });

    return NextResponse.json({
      totalXp,
      xpLast24h,
      level,
      highestLevelReached,
      xpCeiling: ceiling,
      xpCurveExponent: curveExponent,
      xpForCurrentLevel,
      xpForNextLevel,
      progressPct,
      breakdown,
      breakdownLast24h,
      recentActivity,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/level]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
