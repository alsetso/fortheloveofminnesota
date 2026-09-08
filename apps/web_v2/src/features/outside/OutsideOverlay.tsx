'use client';

/**
 * OutsideOverlay — rendered on /outside on top of the explore MapAppShell.
 *
 * Two zones:
 *   1. Persistent bottom card — "you're outside Minnesota" context, level
 *      badge, and a streak claim button when pending XP is ready.
 *   2. In-MN banner — slides in from the top the moment GPS enters MN bounds.
 *      Tapping "Enter Game →" replaces the session gate flag and navigates to /game.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { getAccountHandle } from '@/features/auth/accountDisplay';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import {
  claimAllXp,
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type ClaimXpResult,
} from '@/features/xp/store/pendingXpStore';
import { LevelUpSequence } from '@/features/xp/modals/LevelUpSequence';
import { isWithinMinnesota } from '@/map/location/device/minnesotaBounds';
import {
  getFindMeCoordsSnapshot,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { LOGGED_IN_HOME_PATH } from '@/lib/routes/routePolicy';
import { OUTSIDE_MN_SESSION_KEY } from '@/features/outside/outsideSessionKey';

// ─────────────────────────────────────────────────────────────────────────────

type ClaimState = 'idle' | 'claiming' | 'claimed';

export function OutsideOverlay() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const { level } = useAccountLevel(account?.id ?? null);

  const pendingXp = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    getPendingXpSnapshot,
  );

  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [lastClaim, setLastClaim] = useState<ClaimXpResult | null>(null);

  // ── GPS watcher — detect when user enters MN ──────────────────────────────
  const [inMinnesota, setInMinnesota] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function check(lat: number, lng: number) {
      if (!cancelled && isWithinMinnesota({ lat, lng })) {
        setInMinnesota(true);
      }
    }

    // Check existing fix.
    const snap = getFindMeCoordsSnapshot();
    const fix = snap.coords ?? snap.lookupCoords ?? getFindMeLastCoords();
    if (fix) {
      check(fix.lat, fix.lng);
    }

    // Keep watching — user may be travelling toward MN.
    const unsub = subscribeFindMeCoords(() => {
      const s = getFindMeCoordsSnapshot();
      const f = s.coords ?? s.lookupCoords ?? getFindMeLastCoords();
      if (f) check(f.lat, f.lng);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Refresh pending XP on mount so the claim button shows fresh data.
  useEffect(() => { void refreshPendingXp(); }, []);

  // ── Claim handler ─────────────────────────────────────────────────────────
  async function handleClaim() {
    if (claimState !== 'idle') return;
    setClaimState('claiming');
    setClaimError(null);
    try {
      const result = await claimAllXp();
      if (result) {
        setLastClaim(result);
        setClaimState('claimed');
      } else {
        setClaimError('Claim failed — try again');
        setClaimState('idle');
      }
    } catch {
      setClaimError('Something went wrong');
      setClaimState('idle');
    }
  }

  // ── Enter game ────────────────────────────────────────────────────────────
  function handleEnterGame() {
    // Clear the session flag so OutsideMNGate won't fire again (user is in MN).
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(OUTSIDE_MN_SESSION_KEY, '1');
    }
    router.replace(LOGGED_IN_HOME_PATH);
  }

  if (!account) return null;

  const handle = getAccountHandle(account);
  const levelNum = level?.level ?? null;
  const progressPct = level?.progressPct ?? 0;
  const hasPending = pendingXp.total > 0 && claimState === 'idle';
  const xpReady = !pendingXp.loading;

  return (
    <>
      {/* LevelUpSequence — AppShell isn't mounted on /outside; claim can trigger level-ups. */}
      <LevelUpSequence />

      {/* ── In-MN banner ─────────────────────────────────────────────────── */}
      {inMinnesota && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[200] flex justify-center px-4 animate-slide-down"
          style={{ paddingTop: 'calc(1rem + var(--safe-area-top, env(safe-area-inset-top, 0px)))' }}
        >
          <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-green-700/20 bg-green-600 px-4 py-3 shadow-[0_8px_28px_rgba(22,163,74,0.45)] backdrop-blur-xl">
            <span aria-hidden className="text-xl leading-none">🌲</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-white leading-snug">
                You&apos;re in Minnesota!
              </p>
              <p className="text-[10px] text-green-100/80 leading-snug">
                The full game — territories, collectibles, and XP — is ready.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnterGame}
              className="shrink-0 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur transition active:scale-95 hover:bg-white/30"
            >
              Enter →
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom info card ──────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white/95 shadow-[0_8px_28px_rgba(15,26,23,0.18)] backdrop-blur-xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-[18px] leading-none">🌲</span>
              <div>
                <p className="text-[11px] font-bold text-[#1C1C1E] leading-snug">
                  Outside Minnesota
                </p>
                <p className="text-[10px] text-[#5C6670] leading-snug">
                  Territory XP, collectibles &amp; unlocks require you to be in-state.
                </p>
              </div>
            </div>

            {/* Level badge */}
            {levelNum != null && (
              <div className="shrink-0 flex flex-col items-center gap-0.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1C1C1E]">
                  <span className="text-[11px] font-bold text-white leading-none">
                    {levelNum}
                  </span>
                </div>
                <p className="text-[8px] font-semibold tracking-[0.06em] text-[#5C6670] uppercase">
                  {handle}
                </p>
              </div>
            )}
          </div>

          {/* XP progress bar */}
          {levelNum != null && (
            <div className="px-4 pb-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E9EC]">
                <div
                  className="h-full rounded-full bg-[#1C1C1E] transition-all duration-700"
                  style={{ width: `${Math.max(2, progressPct * 100)}%` }}
                />
              </div>
              {lastClaim ? (
                <p className="mt-1 text-[10px] font-semibold text-green-600">
                  +{lastClaim.claimedAmount.toLocaleString()} XP claimed · Level {lastClaim.highestLevelReached}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-[#5C6670]">
                  Level {levelNum} · {Math.round(progressPct * 100)}% to next
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mx-4 h-px bg-black/6" />

          {/* Streak / claim row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              {claimState === 'claimed' ? (
                <p className="text-[11px] font-semibold text-green-600">
                  Streak claimed — keep the streak alive tomorrow.
                </p>
              ) : hasPending ? (
                <>
                  <p className="text-[11px] font-bold text-[#1C1C1E]">Daily Streak</p>
                  <p className="text-[10px] text-[#5C6670]">
                    +{pendingXp.total.toLocaleString()} XP ready
                  </p>
                </>
              ) : xpReady ? (
                <>
                  <p className="text-[11px] font-bold text-[#1C1C1E]">Daily Streak</p>
                  <p className="text-[10px] text-[#5C6670]">
                    Streak logged — check back tomorrow.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-[#5C6670]">Checking streak…</p>
              )}
              {claimError && (
                <p className="mt-0.5 text-[10px] font-medium text-red-600">{claimError}</p>
              )}
            </div>

            {hasPending && claimState === 'idle' && (
              <button
                type="button"
                onClick={() => void handleClaim()}
                disabled={!xpReady}
                className="shrink-0 rounded-full border border-amber-600/20 bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] transition active:scale-95 hover:bg-amber-400 disabled:opacity-60"
              >
                Claim →
              </button>
            )}
            {claimState === 'claiming' && (
              <span className="shrink-0 text-[11px] text-[#5C6670]">Claiming…</span>
            )}
          </div>

          {/* Footer — aspirational nudge */}
          <div className="border-t border-black/6 bg-[#F7F8F9] px-4 py-2.5">
            <p className="text-[10px] text-[#5C6670]">
              🗺️ &nbsp;Explore the Land of 10,000 Lakes — your territories are waiting when you arrive.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
