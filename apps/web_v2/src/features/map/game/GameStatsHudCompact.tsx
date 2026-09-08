'use client';

/**
 * Condensed standing HUD for the AppShell TopBar trailing slot.
 * Icon-first resource chips — credits → Wallet, hearts → Hearts.
 * Level lives beside the avatar in GameLevelHud.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthSafe } from '@/features/auth';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import type { DockCardId } from '@/features/map/dockCore/dockCard/dockCardTypes';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconHeart, IconWallet } from '@/features/map/dockCore/core/icons';
import {
  useDemoMapChrome,
  demoShowsCoins,
  demoShowsHearts,
} from '@/features/setup/DemoMapChromeContext';
import {
  formatWalletBalance,
  useWalletSummary,
} from '@/features/tools/wallet/useWalletSummary';
import { haptic } from '@/lib/despia/haptics';
import { StatCountSkeleton } from './GameHudSkeletons';

function useCountPulse(value: number, ready: boolean) {
  const [pulse, setPulse] = useState(false);
  const primed = useRef(false);
  const prev = useRef(value);

  useEffect(() => {
    if (!ready) return;
    if (!primed.current) {
      primed.current = true;
      prev.current = value;
      return;
    }
    if (prev.current === value) return;
    prev.current = value;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 480);
    return () => window.clearTimeout(t);
  }, [value, ready]);

  return pulse;
}

function HudStatChip({
  label,
  display,
  pending,
  pulse,
  active,
  icon,
  onClick,
  hud,
}: {
  label: string;
  display: string;
  pending: boolean;
  pulse: boolean;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  hud: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${display} ${label}${active ? '. Close' : ''}`}
      data-hud={hud}
      className={`flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-1.5 py-1 transition active:scale-[0.96] ${
        active ? 'bg-black/[0.05]' : ''
      } ${pulse ? 'animate-hud-stat-pulse' : ''}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-[13px] font-bold tabular-nums tracking-tight text-foreground">
        {pending ? <StatCountSkeleton /> : display}
      </span>
    </button>
  );
}

export function GameStatsHudCompact() {
  const { account } = useAuthSafe();
  const { dockCard, openDockCard, closeDockCard } = useMapDock();
  const { collections, loading: collectionsLoading } = useAccountCollections(
    account?.id ?? null,
  );
  const { summary: wallet, loading: walletLoading } = useWalletSummary();
  const demo = useDemoMapChrome();

  const heartsCollected = collections?.hearts.collected ?? 0;
  const creditsBalance =
    wallet?.isUnlimited ? Number.POSITIVE_INFINITY : (wallet?.balance ?? 0);
  const creditsDisplay = formatWalletBalance(wallet);

  const collectionsPending = collectionsLoading && collections === null;
  const walletPending = walletLoading && wallet == null;

  const stepKey = demo?.stepKey ?? null;
  const showHearts = demoShowsHearts(stepKey);
  const showCredits = demoShowsCoins(stepKey);

  const creditsPulse = useCountPulse(
    Number.isFinite(creditsBalance) ? creditsBalance : 0,
    showCredits && !walletPending,
  );
  const heartsPulse = useCountPulse(heartsCollected, showHearts && !collectionsPending);

  if (!account) return null;
  if (!showCredits && !showHearts) return null;

  const toggleCard = (id: DockCardId) => {
    haptic.toggle();
    if (dockCard === id) {
      closeDockCard();
      return;
    }
    openDockCard(id);
  };

  return (
    <div
      data-hud="standing-compact"
      className="pointer-events-auto flex items-center gap-0.5"
    >
      {showCredits ? (
        <HudStatChip
          hud="credits"
          label={creditsDisplay === '1' ? 'credit' : 'credits'}
          display={creditsDisplay}
          pending={walletPending}
          pulse={creditsPulse}
          active={dockCard === 'wallet'}
          icon={<IconWallet className="h-3.5 w-3.5 text-amber-500" />}
          onClick={() => toggleCard('wallet')}
        />
      ) : null}
      {showHearts ? (
        <HudStatChip
          hud="hearts"
          label={heartsCollected === 1 ? 'heart' : 'hearts'}
          display={heartsCollected.toLocaleString()}
          pending={collectionsPending}
          pulse={heartsPulse}
          active={dockCard === 'hearts'}
          icon={<IconHeart solid className="h-3.5 w-3.5 text-red-500" />}
          onClick={() => toggleCard('hearts')}
        />
      ) : null}
    </div>
  );
}
