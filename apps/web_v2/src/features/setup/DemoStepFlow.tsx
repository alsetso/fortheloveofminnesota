'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { haptic } from '@/lib/despia/haptics';
import { LOGGED_IN_HOME_PATH } from '@/lib/routes/routePolicy';
import {
  DEMO_STEPS,
  DEMO_STEPS_TOTAL,
  demoStepPrompt,
  type DemoStep,
} from './demoSteps';
import {
  getDemoCollectProgress,
  subscribeDemoCollectProgress,
} from './seedDemoCollectibles';
import {
  claimAllXp,
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type ClaimXpResult,
  type PendingXpItem,
} from '@/features/xp/store/pendingXpStore';
import { XpClaimedSuccessModal } from '@/features/xp/modals/XpClaimedSuccessModal';
import {
  getFindMeCoordsSnapshot,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import {
  syncCurrentTerritoryStack,
  type NewlyUnlockedTerritory,
} from '@/features/accountTerritories/db/syncCurrentTerritoryStack';

// ─── Minnesota bounds check ───────────────────────────────────────────────────

/**
 * Approximate bounding box for Minnesota. Used to give a friendly heads-up
 * when a user enters the demo from outside the state — not a hard block.
 */
function isInMinnesota(lat: number, lng: number): boolean {
  return lat >= 43.5 && lat <= 49.4 && lng >= -97.3 && lng <= -89.4;
}

type LocationGateStatus =
  /** Waiting for the GPS fix to resolve. */
  | 'checking'
  /** GPS confirmed and user is inside Minnesota. */
  | 'confirmed'
  /** No GPS fix after timeout — likely denied or unavailable. */
  | 'no_gps'
  /** GPS on but coordinates are outside Minnesota. */
  | 'outside_mn';

export interface DemoFlowState {
  stepIndex: number;
  step: DemoStep;
  actionDetected: boolean;
  saving: boolean;
  onInteraction: () => void;
  onGotIt: () => void;
  onRestart: () => void;
}

export type UseDemoFlowOptions = {
  /** Fired once when the final step completes — hold MapAppShell until /game mounts. */
  onFinishing?: () => void;
};

export function useDemoFlow(
  enabled: boolean,
  options: UseDemoFlowOptions = {},
): DemoFlowState {
  const { account, applyAccount } = useAuthSafe();
  const router = useRouter();
  const onFinishingRef = useRef(options.onFinishing);
  onFinishingRef.current = options.onFinishing;

  const initialStep = Math.min((account?.account_demo_steps ?? 0), DEMO_STEPS_TOTAL - 1);
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [actionDetected, setActionDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Sync from server when account hydrates late or a mid-session refresh advances the step.
  useEffect(() => {
    if (!account) return;
    const serverStep = Math.min((account.account_demo_steps ?? 0), DEMO_STEPS_TOTAL - 1);
    setStepIndex((prev) => (serverStep > prev ? serverStep : prev));
  }, [account?.account_demo_steps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActionDetected(false); }, [stepIndex]);

  const onInteraction = useCallback(() => {
    setActionDetected((prev) => {
      if (prev) return prev;
      haptic.play('light');
      return true;
    });
  }, []);

  const onGotIt = useCallback(async () => {
    if (!enabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    haptic.play('heavy');

    const nextCount = stepIndex + 1;
    const finishing = nextCount >= DEMO_STEPS_TOTAL;

    // On completing find_me (step 0), refresh pending XP so the claim_streak
    // chip has the streak total ready by the time it mounts.
    if (stepIndex === 0) {
      void refreshPendingXp();
    }

    if (finishing) {
      onFinishingRef.current?.();
      try {
        await fetch('/api/accounts/demo-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: nextCount }),
        });
      } catch { /* Non-fatal */ }
      router.replace(LOGGED_IN_HOME_PATH);
      if (account) applyAccount({ ...account, account_demo_steps: nextCount });
      router.refresh();
      savingRef.current = false;
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/accounts/demo-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextCount }),
      });
      if (res.ok && account) applyAccount({ ...account, account_demo_steps: nextCount });
    } catch {
      if (account) applyAccount({ ...account, account_demo_steps: nextCount });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    setStepIndex(nextCount);
  }, [enabled, stepIndex, account, applyAccount, router]);

  const onRestart = useCallback(async () => {
    if (!enabled || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    haptic.play('light');

    try {
      await fetch('/api/accounts/demo-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 0 }),
      });
      if (account) applyAccount({ ...account, account_demo_steps: 0 });
    } catch {
      if (account) applyAccount({ ...account, account_demo_steps: 0 });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    setActionDetected(false);
    setStepIndex(0);
  }, [enabled, account, applyAccount]);

  const step = DEMO_STEPS[stepIndex]!;
  return { stepIndex, step, actionDetected, saving, onInteraction, onGotIt, onRestart };
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface DemoStepPanelProps {
  stepIndex: number;
  total: number;
  step: DemoStep;
  actionDetected: boolean;
  saving: boolean;
  onGotIt: () => void;
  onRestart?: () => void;
  /** Passed so claim-style steps (claim_streak, unlock_territories) can fire
   *  actionDetected directly from their Claim button. */
  onInteraction?: () => void;
}

export function DemoStepPanel({
  stepIndex,
  total,
  step,
  actionDetected,
  saving,
  onGotIt,
  onRestart,
  onInteraction,
}: DemoStepPanelProps) {
  const collectProgress = useSyncExternalStore(
    subscribeDemoCollectProgress,
    getDemoCollectProgress,
    getDemoCollectProgress,
  );

  if (step.key === 'claim_streak') {
    return (
      <DemoStreakClaimChip
        stepIndex={stepIndex}
        total={total}
        actionDetected={actionDetected}
        saving={saving}
        onInteraction={onInteraction ?? (() => {})}
        onGotIt={onGotIt}
      />
    );
  }

  if (step.key === 'unlock_territories') {
    return (
      <DemoTerritoryUnlockChip
        stepIndex={stepIndex}
        total={total}
        actionDetected={actionDetected}
        saving={saving}
        onInteraction={onInteraction ?? (() => {})}
        onGotIt={onGotIt}
      />
    );
  }

  const waitingLabel =
    step.key === 'collect_heart'
      ? collectProgress.heartCollected ? 'Heart collected!' : 'Tap the heart model near you…'
      : step.key === 'collect_coin'
      ? collectProgress.coinCollected  ? 'Coin collected!'  : 'Tap the coin model near you…'
      : 'Try it…';

  const isFinalStep = stepIndex === total - 1;
  const showRestart = isFinalStep && actionDetected && !!onRestart;
  const prompt = demoStepPrompt(step);

  return (
    <div
      key={stepIndex}
      role="region"
      aria-label={`Map tutorial step ${stepIndex + 1} of ${total}`}
      className="demo-rail-in pointer-events-auto min-w-0 w-full"
    >
      <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
          Step {stepIndex + 1} of {total}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          <span className="font-bold">{step.title}</span>
          {' — '}
          {prompt}
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          {!actionDetected ? (
            <div className="flex min-h-[2rem] flex-1 items-center gap-2 px-0.5">
              <span className="waiting-pulse inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C6670]" />
              <span className="truncate text-[11px] font-medium text-[#5C6670]">
                {waitingLabel}
              </span>
            </div>
          ) : showRestart ? (
            <>
              <button
                type="button"
                onClick={onRestart}
                disabled={saving}
                className="min-w-[3.25rem] flex-1 rounded-full border border-red-700/20 bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition active:scale-95 hover:bg-red-500 disabled:opacity-60"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={onGotIt}
                disabled={saving}
                className="min-w-[3.25rem] flex-[1.2] rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60"
              >
                {saving ? '…' : (step.gotItLabel ?? 'Got it')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onGotIt}
              disabled={saving}
              className="demo-got-it min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60"
            >
              {saving ? '…' : (step.gotItLabel ?? 'Got it')}
            </button>
          )}
        </div>
      </div>
      <DemoChipStyles />
    </div>
  );
}

// ─── Streak claim chip ────────────────────────────────────────────────────────

interface DemoStreakClaimChipProps {
  stepIndex: number;
  total: number;
  actionDetected: boolean;
  saving: boolean;
  onInteraction: () => void;
  onGotIt: () => void;
}

type ClaimReceipt = {
  result: ClaimXpResult;
  sources: PendingXpItem[];
};

function DemoStreakClaimChip({
  stepIndex,
  total,
  actionDetected,
  saving,
  onInteraction,
  onGotIt,
}: DemoStreakClaimChipProps) {
  const pendingXp = useSyncExternalStore(subscribePendingXp, getPendingXpSnapshot, getPendingXpSnapshot);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed]   = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);

  // ── Location gate — GPS must be on and user ideally inside Minnesota ────────
  const [locationGate, setLocationGate] = useState<LocationGateStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function resolve(lat: number, lng: number) {
      if (cancelled) return;
      setLocationGate(isInMinnesota(lat, lng) ? 'confirmed' : 'outside_mn');
    }

    // Check for an existing fix first (find_me step typically provides one).
    const snap = getFindMeCoordsSnapshot();
    const fix = snap.coords ?? snap.lookupCoords ?? getFindMeLastCoords();
    if (fix) {
      resolve(fix.lat, fix.lng);
    } else {
      // Wait up to 10s for GPS to resolve.
      const unsub = subscribeFindMeCoords(() => {
        const s = getFindMeCoordsSnapshot();
        const f = s.coords ?? s.lookupCoords ?? getFindMeLastCoords();
        if (f && !cancelled) {
          clearTimeout(timer);
          unsub();
          resolve(f.lat, f.lng);
        }
      });
      timer = setTimeout(() => {
        if (!cancelled) { unsub(); setLocationGate('no_gps'); }
      }, 10_000);
      return () => { cancelled = true; unsub(); clearTimeout(timer); };
    }

    return () => { cancelled = true; };
  }, []); // once on mount

  // Refresh pending XP on mount — MapAppShell already fired logWorldSession
  // which triggers the streak grant server-side. find_me's onGotIt pre-fetches
  // this so the total is usually ready by the time the chip mounts.
  useEffect(() => { void refreshPendingXp(); }, []);

  // Once XP finishes loading and it's already 0, show the skip state immediately.
  const xpReady  = !pendingXp.loading;
  const hasXp    = pendingXp.total > 0;
  // Show actual amount in the button — never lie with a fake +1.
  const xpToShow = pendingXp.total;

  async function handleClaim() {
    if (claiming || claimed) return;
    haptic.play('light');
    setClaimError(null);
    setClaiming(true);

    // Snapshot sources before the claim clears pendingXp — used for the receipt breakdown.
    const sourcesSnapshot = [...pendingXp.items];
    const result = await claimAllXp();
    setClaiming(false);

    if (result === null) {
      // Network error — offer a retry but don't block the user forever.
      setClaimError('Could not reach server — tap Retry or skip past this step.');
      return;
    }

    // If the claim crossed a level, show the XP receipt first → the modal's
    // Continue releases the LevelUpSequence queue (1→2, then 2→3). After both
    // ceremonies are confirmed, the chip is already in "claimed" state showing
    // "Got it ✓" so the user naturally taps to advance the demo step.
    if (result.levelUpPrepared) {
      setReceipt({ result, sources: sourcesSnapshot });
    }

    setClaimed(true);
    onInteraction();
  }

  async function handleRetry() {
    setClaimError(null);
    await handleClaim();
  }

  function handleSkip() {
    haptic.play('light');
    setClaimed(true);
    onInteraction();
  }

  return (
    <>
      {/* ── Location gate ─────────────────────────────────────────────────── */}
      {locationGate === 'checking' && (
        <div
          key="loc-checking"
          className="demo-rail-in pointer-events-auto min-w-0 w-full"
        >
          <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
              Step {stepIndex + 1} of {total}
            </p>
            <div className="mt-1 flex min-h-[2rem] items-center gap-2 px-0.5">
              <span className="waiting-pulse inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C6670]" />
              <span className="text-[11px] font-medium text-[#5C6670]">
                Checking your location…
              </span>
            </div>
          </div>
          <DemoChipStyles />
        </div>
      )}

      {locationGate === 'no_gps' && (
        <div
          key="loc-no-gps"
          className="demo-rail-in pointer-events-auto min-w-0 w-full"
        >
          <div className="rounded-2xl border border-amber-400/30 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
              Step {stepIndex + 1} of {total}
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#1C1C1E]">
              Location needed
            </p>
            <p className="mt-0.5 text-[11px] text-[#5C6670]">
              For the Love of Minnesota uses your location to unlock territories and find collectibles near you.
            </p>
            <p className="mt-1 text-[10px] font-medium text-amber-700">
              Go to Settings → Privacy → Location Services and enable location for this app, then come back.
            </p>
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  // Re-check: a fix may have arrived while reading the message.
                  const snap = getFindMeCoordsSnapshot();
                  const fix = snap.coords ?? snap.lookupCoords ?? getFindMeLastCoords();
                  if (fix) {
                    setLocationGate(isInMinnesota(fix.lat, fix.lng) ? 'confirmed' : 'outside_mn');
                  } else {
                    // Give another 5s
                    setLocationGate('checking');
                  }
                }}
                className="min-w-[3.25rem] rounded-full border border-amber-600/20 bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition active:scale-95 hover:bg-amber-400"
              >
                Check again
              </button>
            </div>
          </div>
          <DemoChipStyles />
        </div>
      )}

      {locationGate === 'outside_mn' && (
        <div
          key="loc-outside"
          className="demo-rail-in pointer-events-auto min-w-0 w-full"
        >
          <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
              Step {stepIndex + 1} of {total}
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#1C1C1E]">
              Outside Minnesota
            </p>
            <p className="mt-0.5 text-[11px] text-[#5C6670]">
              For the Love of Minnesota is built for the Land of 10,000 Lakes. Territory unlocks and collectibles work best when you&apos;re in-state.
            </p>
            <p className="mt-0.5 text-[10px] text-[#5C6670]/70">
              You can still explore the demo — just know that some steps work better when you&apos;re home.
            </p>
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setLocationGate('confirmed')}
                className="min-w-[3.25rem] rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500"
              >
                Continue anyway →
              </button>
            </div>
          </div>
          <DemoChipStyles />
        </div>
      )}

      {/* ── Normal claim chip — shown once location is confirmed ────────────── */}
      {locationGate === 'confirmed' && (
        <div
          key={stepIndex}
          role="region"
          aria-label={`Map tutorial step ${stepIndex + 1} of ${total}`}
          className="demo-rail-in pointer-events-auto min-w-0 w-full"
        >
          <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
              Step {stepIndex + 1} of {total}
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#1C1C1E]">
              Day 1 Streak
            </p>

            {xpReady && hasXp && (
              <p className="mt-0.5 text-[11px] text-[#5C6670]">
                +{xpToShow.toLocaleString()} XP ready to claim
              </p>
            )}
            {xpReady && !hasXp && !claimed && (
              <p className="mt-0.5 text-[11px] text-[#5C6670]">
                Streak logged — nothing pending right now
              </p>
            )}
            {!xpReady && (
              <p className="mt-0.5 text-[11px] text-[#5C6670]">Checking your streak…</p>
            )}

            {claimError && (
              <p className="mt-1 text-[10px] font-medium text-red-600" role="alert">
                {claimError}
              </p>
            )}

            <div className="mt-2.5 flex items-center gap-2">
              {claimed ? (
                <button
                  type="button"
                  onClick={onGotIt}
                  disabled={saving}
                  className="demo-got-it min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60"
                >
                  {saving ? '…' : 'Got it ✓'}
                </button>
              ) : claimError ? (
                <>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="min-w-[3.25rem] flex-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5C6670] transition active:scale-95"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    disabled={claiming}
                    className="min-w-[3.25rem] flex-[1.2] rounded-full border border-amber-600/20 bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition active:scale-95 hover:bg-amber-400 disabled:opacity-60"
                  >
                    Retry
                  </button>
                </>
              ) : xpReady && !hasXp ? (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="demo-got-it min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleClaim()}
                  disabled={claiming || !xpReady}
                  className="min-w-[3.25rem] flex-1 rounded-full border border-amber-600/20 bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(245,158,11,0.4)] transition active:scale-95 hover:bg-amber-400 disabled:opacity-60"
                >
                  {claiming ? 'Claiming…' : !xpReady ? 'Checking…' : `Claim +${xpToShow.toLocaleString()} XP →`}
                </button>
              )}
            </div>
          </div>
          <DemoChipStyles />
        </div>
      )}

      {/* XP receipt → releases LevelUpSequence for level-up ceremonies.
          Only shown when the claim crossed a level boundary (levelUpPrepared).
          User taps Continue → 1→2 ceremony plays → 2→3 ceremony plays →
          both confirmed → receipt closes → chip shows "Got it ✓". */}
      {receipt && (
        <XpClaimedSuccessModal
          title="Claimed!"
          rewardLine={`+${receipt.result.claimedAmount.toLocaleString()} XP`}
          standingLine={`Level ${receipt.result.highestLevelReached} · ${receipt.result.totalXp.toLocaleString()} XP total`}
          sources={receipt.sources.map((item) => ({
            id: item.id,
            name: item.name,
            detail: item.sourceLabel,
            amount: item.amount,
          }))}
          levelUpPrepared={receipt.result.levelUpPrepared}
          onClose={() => setReceipt(null)}
        />
      )}
    </>
  );
}

// ─── Territory unlock chip ────────────────────────────────────────────────────
// Self-contained: fires syncCurrentTerritoryStack, shows real territory cards
// inline, claims XP directly. No dependency on TerritoryUnlockModal.

type TerritoryChipStatus = 'scanning' | 'ready' | 'claimed' | 'skipped';

interface DemoTerritoryUnlockChipProps {
  stepIndex: number;
  total: number;
  actionDetected: boolean;
  saving: boolean;
  onInteraction: () => void;
  onGotIt: () => void;
}

const KIND_LABEL: Record<string, string> = {
  county:          'County',
  ctu:             'City / Township',
  school_district: 'School District',
  township:        'Township',
  city:            'City',
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, ' ');
}

function DemoTerritoryUnlockChip({
  stepIndex,
  total,
  saving,
  onInteraction,
  onGotIt,
}: DemoTerritoryUnlockChipProps) {
  const [status, setStatus]           = useState<TerritoryChipStatus>('scanning');
  const [territories, setTerritories] = useState<NewlyUnlockedTerritory[]>([]);
  const [claiming, setClaiming]       = useState(false);
  const firedRef                      = useRef(false);

  // Resolve current coords and fire sync on mount.
  useEffect(() => {
    let cancelled = false;
    let gpsTimer: ReturnType<typeof setTimeout> | null = null;

    function resolveCoords() {
      const snap = getFindMeCoordsSnapshot();
      return snap.coords ?? snap.lookupCoords ?? getFindMeLastCoords();
    }

    async function doSync(fix: { lat: number; lng: number }) {
      try {
        const result = await syncCurrentTerritoryStack(fix.lat, fix.lng, { postPresence: true });
        if (cancelled) return;

        // Ordered by XP descending — show all records.
        const unlocked = [...result.newlyUnlocked]
          .sort((a, b) => b.xpAmount - a.xpAmount);

        if (unlocked.length === 0) {
          // All territories already unlocked — silently advance.
          setStatus('skipped');
          if (!firedRef.current) { firedRef.current = true; onInteraction(); }
          return;
        }

        setTerritories(unlocked);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('skipped');
          if (!firedRef.current) { firedRef.current = true; onInteraction(); }
        }
      }
    }

    const fix = resolveCoords();
    if (fix) {
      void doSync(fix);
    } else {
      // Wait for a GPS fix before syncing, with a 15s timeout.
      const unsub = subscribeFindMeCoords(() => {
        const f = resolveCoords();
        if (f && !cancelled) {
          unsub();
          if (gpsTimer) { clearTimeout(gpsTimer); gpsTimer = null; }
          void doSync(f);
        }
      });

      gpsTimer = setTimeout(() => {
        if (!cancelled) {
          unsub();
          setStatus('skipped');
          if (!firedRef.current) { firedRef.current = true; onInteraction(); }
        }
      }, 15_000);

      return () => {
        cancelled = true;
        unsub();
        if (gpsTimer) clearTimeout(gpsTimer);
      };
    }

    return () => { cancelled = true; };
  }, []); // intentionally once on mount

  const totalXp = territories.reduce((sum, t) => sum + t.xpAmount, 0);

  async function handleClaim() {
    if (claiming || status === 'claimed') return;
    haptic.play('light');
    setClaiming(true);
    await claimAllXp();
    setClaiming(false);
    setStatus('claimed');
    if (!firedRef.current) { firedRef.current = true; onInteraction(); }
  }

  return (
    <div
      key={stepIndex}
      role="region"
      aria-label={`Map tutorial step ${stepIndex + 1} of ${total}`}
      className="demo-rail-in pointer-events-auto min-w-0 w-full"
    >
      <div className="rounded-2xl border border-black/10 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
          Step {stepIndex + 1} of {total}
        </p>

        <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#1C1C1E]">
          Unlock Your Areas
        </p>

        {/* Territory records — preview on ready, per-record save indicator on claimed */}
        {(status === 'ready' || status === 'claimed') && territories.length > 0 && (
          <>
            <ul className="mt-1.5 space-y-0.5">
              {territories.map((t) => (
                <li key={t.unitId} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1">
                    {status === 'claimed' && (
                      <span className="shrink-0 text-[10px] font-bold text-emerald-600">✓</span>
                    )}
                    <span className="truncate text-[10px] font-medium text-[#1C1C1E]">
                      {t.name}
                      <span className="ml-1 text-[9px] font-normal text-[#5C6670]">
                        {kindLabel(t.unitKind)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-600">
                    +{t.xpAmount} XP
                  </span>
                </li>
              ))}
            </ul>
            {status === 'ready' && (
              <p className="mt-1.5 text-[10px] text-[#5C6670]">
                This happens automatically every time you enter a new county, city, or district.
              </p>
            )}
          </>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          {status === 'scanning' && (
            <div className="flex min-h-[2rem] flex-1 items-center gap-2 px-0.5">
              <span className="waiting-pulse inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#5C6670]" />
              <span className="text-[11px] font-medium text-[#5C6670]">
                Scanning your location…
              </span>
            </div>
          )}

          {status === 'ready' && (
            <button
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              className="min-w-[3.25rem] flex-1 rounded-full border border-blue-700/20 bg-blue-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)] transition active:scale-95 hover:bg-blue-500 disabled:opacity-60"
            >
              {claiming
                ? 'Saving…'
                : `Save ${territories.length} ${territories.length === 1 ? 'area' : 'areas'} →`}
            </button>
          )}

          {(status === 'claimed' || status === 'skipped') && (
            <button
              type="button"
              onClick={onGotIt}
              disabled={saving}
              className="demo-got-it min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60"
            >
              {saving ? '…' : 'Got it'}
            </button>
          )}
        </div>
      </div>
      <DemoChipStyles />
    </div>
  );
}

// ─── Shared animation styles ──────────────────────────────────────────────────

function DemoChipStyles() {
  return (
    <style>{`
      @keyframes demoRailIn {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .demo-rail-in { animation: demoRailIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

      @keyframes demoGotIt {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
      }
      .demo-got-it { animation: demoGotIt 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

      @keyframes waitingPulse {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50%       { opacity: 0.9; transform: scale(1.15); }
      }
      .waiting-pulse { animation: waitingPulse 1.6s ease-in-out infinite; }
    `}</style>
  );
}
