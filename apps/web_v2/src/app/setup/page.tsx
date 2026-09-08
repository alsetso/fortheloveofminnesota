'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapAppShell } from '@/components/shell/MapAppShell';
import { SetupMapScene } from '@/features/setup/SetupMapScene';
import { useAuthSafe } from '@/features/auth';
import AccountSelector from '@/features/setup/AccountSelector';
import SetupScreen from '@/features/setup/SetupScreen';
import {
  DemoStepPanel,
  useDemoFlow,
} from '@/features/setup/DemoStepFlow';
import { ResetupButton } from '@/features/setup/ResetupButton';
import { DEMO_STEPS_TOTAL } from '@/features/setup/demoSteps';
import { resolveBootDestination } from '@/features/welcome/boot/resolveBootDestination';
import {
  isAccountComplete,
  isAuthSetupComplete,
  isDemoComplete,
} from '@/lib/account/accountCompleteness';
import { LOGGED_IN_HOME_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';
import { usePathname } from 'next/navigation';

// ─── Skip Demo ────────────────────────────────────────────────────────────────

function SkipDemoButton({ onSkip }: { onSkip: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFirstTap = () => {
    setConfirming(true);
    cancelRef.current = setTimeout(() => setConfirming(false), 4000);
  };

  const handleCancel = () => {
    if (cancelRef.current) clearTimeout(cancelRef.current);
    setConfirming(false);
  };

  const handleConfirm = async () => {
    if (cancelRef.current) clearTimeout(cancelRef.current);
    setBusy(true);
    await onSkip();
    setBusy(false);
  };

  return (
    <div
      className="pointer-events-auto flex items-center gap-2"
      style={{ paddingTop: safePadTop('0.75rem') }}
    >
      {confirming ? (
        <>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full bg-black/20 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-md transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="rounded-full bg-black/30 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-md transition active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Skipping…' : 'Yes, skip →'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleFirstTap}
          className="rounded-full bg-black/20 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-md transition active:scale-95"
        >
          Skip demo
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * /setup — Auth + profile + demo onboarding hub.
 *
 * Phases (in order):
 *   loading  → auth resolving or account fetch in flight
 *   error    → account fetch failed (AccountSelector error state)
 *   selector → multi-account picker (AccountSelector normal state)
 *   onboard  → email verify / password / profile card (SetupScreen)
 *   demo     → 12-step interactive map tour (MapAppShell + DemoStepPanel)
 *   exiting  → final step committed, holding MapAppShell while /game mounts
 */
type SetupPhase = 'loading' | 'error' | 'selector' | 'onboard' | 'demo' | 'exiting';

function derivePhase({
  kind,
  needsAccountSelection,
  selectingAccountId,
  user,
  authDone,
  profileDone,
  demoDone,
  exiting,
}: {
  kind: string;
  needsAccountSelection: boolean;
  selectingAccountId: string | null;
  user: unknown;
  authDone: boolean;
  profileDone: boolean;
  demoDone: boolean;
  exiting: boolean;
}): SetupPhase {
  if (kind === 'setup_error') return 'error';

  const isSelector = needsAccountSelection || !!selectingAccountId;

  if (isSelector) return 'selector';
  if (kind !== 'setup' || !user) return 'loading';
  if (!authDone || !profileDone) return 'onboard';
  if (exiting) return 'exiting';
  if (!demoDone) return 'demo';

  // demoDone + kind === 'setup' means boot destination is handling redirect
  return 'loading';
}

export default function SetupPage() {
  const {
    user,
    account,
    accounts,
    accountLoading,
    accountFetchFailed,
    needsAccountSelection,
    selectingAccountId,
    authStatus,
    retryAccountFetch,
    applyAccount,
  } = useAuthSafe();
  const pathname = usePathname();
  const router = useRouter();

  const [exiting, setExiting] = useState(false);

  const destination = resolveBootDestination({
    authStatus,
    user,
    account,
    accountLoading,
    needsAccountSelection,
    accountFetchFailed,
    pathname,
  });

  const authDone    = isAuthSetupComplete(user);
  const profileDone = isAccountComplete(account);
  const demoDone    = isDemoComplete(account);

  const phase = derivePhase({
    kind: destination.kind,
    needsAccountSelection,
    selectingAccountId,
    user,
    authDone,
    profileDone,
    demoDone,
    exiting,
  });

  const demoActive = phase === 'demo';
  const demo = useDemoFlow(demoActive, { onFinishing: () => setExiting(true) });

  // Reset exiting flag if the user somehow navigates back into demo state.
  useEffect(() => {
    if (demoActive) setExiting(false);
  }, [demoActive]);

  const demoConfig = useMemo(
    () =>
      demoActive
        ? { stepKey: demo.step.key, onInteraction: demo.onInteraction }
        : null,
    [demoActive, demo.step.key, demo.onInteraction],
  );

  const demoPanel = useMemo(
    () =>
      demoActive ? (
        <div className="flex flex-col gap-1.5 min-w-0 w-full">
          <DemoStepPanel
            stepIndex={demo.stepIndex}
            total={DEMO_STEPS_TOTAL}
            step={demo.step}
            actionDetected={demo.actionDetected}
            saving={demo.saving}
            onGotIt={demo.onGotIt}
            onRestart={demo.onRestart}
            onInteraction={demo.onInteraction}
          />
          <ResetupButton />
        </div>
      ) : null,
    [
      demoActive,
      demo.stepIndex,
      demo.step,
      demo.actionDetected,
      demo.saving,
      demo.onGotIt,
      demo.onRestart,
      demo.onInteraction,
    ],
  );

  const onSkipDemo = useCallback(async () => {
    try {
      await fetch('/api/accounts/skip-demo', { method: 'POST' });
    } catch { /* non-fatal — optimistic update below still fires */ }
    if (account) applyAccount({ ...account, skipped_demo: true });
    router.replace(LOGGED_IN_HOME_PATH);
    router.refresh();
  }, [account, applyAccount, router]);

  // Map shell stays mounted across demo → exiting to prevent Capitol/game flash.
  const showDemoShell  = phase === 'demo' || phase === 'exiting';
  const showCinematicMap = phase === 'onboard' || phase === 'selector' || phase === 'error';

  return (
    <div className="relative isolate min-h-dvh w-full overflow-hidden">
      {showDemoShell ? (
        <MapAppShell demo={demoConfig} demoPanel={demoPanel} />
      ) : showCinematicMap ? (
        <SetupMapScene />
      ) : (
        <div className="absolute inset-0 bg-[#1a2420]" aria-hidden />
      )}

      {/* Skip Demo — top-left pill, only during active demo steps */}
      {phase === 'demo' ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[300] flex px-4">
          <SkipDemoButton onSkip={onSkipDemo} />
        </div>
      ) : null}

      {phase === 'error' ? (
        <AccountSelector
          loading={accountLoading}
          failedFetch
          onRetry={retryAccountFetch}
        />
      ) : phase === 'selector' ? (
        <AccountSelector loading={accountLoading && accounts.length === 0} />
      ) : phase === 'onboard' ? (
        <SetupScreen />
      ) : null}
    </div>
  );
}
