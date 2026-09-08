import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  createServiceRoleClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

/**
 * POST /api/accounts/resetup
 *
 * Deep-reset the account to a fresh onboarding state for re-testing.
 *
 *   Wiped (best-effort — individual table failures become warnings, not fatal):
 *     • account_xp_transactions     (public schema)
 *     • account_level_state         (public schema)
 *     • account_territory_presence  (public schema)
 *     • world.world_collections     (world schema)
 *     • account_world_sessions      (public schema)
 *
 *   Always executed regardless of wipe failures:
 *     • accounts.account_demo_steps → 0  (gates /game until demo re-completed)
 *     • accounts.onboarded → false       (profile card re-confirms avatar pick on next load)
 *
 *   Preserved:
 *     • name, username, photo (image_url), email
 *     • All community / social data
 *
 * A JSON snapshot is written to resetup_revert_logs before deletion.
 * If that table doesn't exist yet (migration not applied), the log
 * write is skipped non-fatally and the wipe still proceeds.
 */
export async function POST() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = session.accountId;
    const service       = createServiceRoleClient();          // public schema
    const serviceWorld  = createServiceRoleClient('world');   // world schema

    // ── 1. Snapshot current game data ─────────────────────────────────────
    const [xpRes, levelRes, territoryRes, collectionsRes, sessionsRes] =
      await Promise.all([
        service.from('account_xp_transactions').select('*').eq('account_id', accountId),
        service.from('account_level_state').select('*').eq('account_id', accountId),
        service.from('account_territory_presence').select('*').eq('account_id', accountId),
        serviceWorld.from('world_collections').select('*').eq('account_id', accountId),
        service.from('account_world_sessions').select('*').eq('account_id', accountId),
      ]);

    const snapshot = {
      snapshot_at: new Date().toISOString(),
      account_id: accountId,
      xp_transactions: xpRes.data ?? [],
      level_state: levelRes.data ?? [],
      territory_presence: territoryRes.data ?? [],
      world_collections: collectionsRes.data ?? [],
      world_sessions: sessionsRes.data ?? [],
    };

    // ── 2. Persist revert log (non-fatal if table not yet migrated) ────────
    try {
      await service.from('resetup_revert_logs').insert({ account_id: accountId, snapshot });
    } catch (logErr) {
      console.warn('[resetup] revert log skipped (table may not exist yet):', logErr);
    }

    // ── 3. Wipe game data (best-effort — log failures, don't abort) ────────
    const [delXp, delLevel, delTerritory, delCollections, delSessions] =
      await Promise.all([
        service.from('account_xp_transactions').delete().eq('account_id', accountId),
        service.from('account_level_state').delete().eq('account_id', accountId),
        service.from('account_territory_presence').delete().eq('account_id', accountId),
        serviceWorld.from('world_collections').delete().eq('account_id', accountId),
        service.from('account_world_sessions').delete().eq('account_id', accountId),
      ]);

    const warnings: string[] = [
      delXp.error       && `xp_transactions: ${delXp.error.message}`,
      delLevel.error    && `level_state: ${delLevel.error.message}`,
      delTerritory.error && `territory_presence: ${delTerritory.error.message}`,
      delCollections.error && `world_collections: ${delCollections.error.message}`,
      delSessions.error  && `world_sessions: ${delSessions.error.message}`,
    ].filter(Boolean) as string[];

    if (warnings.length > 0) {
      console.warn('[resetup] partial wipe — warnings:', warnings);
    }

    // ── 4. ALWAYS reset demo + onboarded (even if wipe was partial) ──────────
    // Sets onboarded=false so the profile wizard re-opens at the avatar picker.
    // Username, display name, and image_url are preserved — the wizard just
    // pre-fills them so the user only needs to confirm / re-pick their avatar.
    // Once they submit, onboarded flips back to true and the demo starts fresh.
    const supabase = await createSupabaseServerClient();
    const { error: resetError } = await supabase
      .from('accounts')
      .update({ account_demo_steps: 0, onboarded: false })
      .eq('id', accountId)
      .eq('user_id', session.userId);

    if (resetError) {
      console.error('[resetup] demo step reset failed:', resetError.message);
      return NextResponse.json(
        { success: false, error: 'Demo step reset failed — game data may be partially wiped.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      wiped: {
        xp_transactions:  !delXp.error,
        level_state:      !delLevel.error,
        territory_presence: !delTerritory.error,
        world_collections:  !delCollections.error,
        world_sessions:   !delSessions.error,
      },
    });
  } catch (err) {
    console.error('[resetup]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
