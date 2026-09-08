'use client';

/**
 * Pending XP — claim chip + claim sheet.
 * Surfaces unclaimed XP the account hasn't banked yet, with per-source detail
 * and "Claim all". After claim, swaps to the XP Receipt (Claimed!), which may
 * Continue into the Level Up Ceremony.
 *
 * On /game the chip is relative in the top-left chrome (above CampaignCard).
 * Other surfaces still get the fixed centered chip via `hidePill={false}`.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { haptic } from '@/lib/despia/haptics';
import { safePadTop } from '@/lib/despia/safeArea';
import {
  claimAllXp,
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type ClaimXpResult,
  type PendingXpItem,
  type PendingXpState,
} from '@/features/xp/store/pendingXpStore';
import { XpClaimedSuccessModal } from '@/features/xp/modals/XpClaimedSuccessModal';
import { useDemoMapChrome } from '@/features/setup/DemoMapChromeContext';

const EMPTY_STATE: PendingXpState = { total: 0, count: 0, items: [], loading: false };

let sheetOpen = false;
const sheetListeners = new Set<() => void>();

function subscribeXpClaimSheet(listener: () => void): () => void {
  sheetListeners.add(listener);
  return () => {
    sheetListeners.delete(listener);
  };
}

function getXpClaimSheetOpen(): boolean {
  return sheetOpen;
}

export function openXpClaimSheet(): void {
  if (sheetOpen) return;
  sheetOpen = true;
  for (const listener of sheetListeners) listener();
}

function closeXpClaimSheet(): void {
  if (!sheetOpen) return;
  sheetOpen = false;
  for (const listener of sheetListeners) listener();
}

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Relative unclaimed-XP Review pill — sits in /game top-left chrome. */
export function PendingXpReviewPill() {
  const demo = useDemoMapChrome();
  const pending = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_STATE,
  );

  if (demo !== null || pending.count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        haptic.toggle();
        openXpClaimSheet();
      }}
      className="pointer-events-auto relative flex items-center gap-2 rounded-full bg-[#1c1c1e] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition active:scale-[0.97]"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#5BA3FF]/20 text-[11px] text-[#5BA3FF]">
        ✦
      </span>
      +{pending.total} XP to claim
      <span className="text-white/40">·</span>
      <span className="text-[#5BA3FF]">Review</span>
    </button>
  );
}

export function XpOverlay({
  accountId,
  hidePill = false,
}: {
  accountId: string | null | undefined;
  /** When true, the chip is hosted elsewhere (GameDock top-left). */
  hidePill?: boolean;
}) {
  const pending = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_STATE,
  );
  const open = useSyncExternalStore(
    subscribeXpClaimSheet,
    getXpClaimSheetOpen,
    () => false,
  );
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{
    result: ClaimXpResult;
    sources: PendingXpItem[];
  } | null>(null);

  useEffect(() => {
    if (!accountId) return;
    void refreshPendingXp();
  }, [accountId]);

  async function handleClaimAll() {
    const snapshot = [...pending.items];
    setClaiming(true);
    const result = await claimAllXp();
    setClaiming(false);
    if (result) {
      haptic.collect.success();
      closeXpClaimSheet();
      setClaimed({ result, sources: snapshot });
    }
  }

  if (claimed) {
    return (
      <XpClaimedSuccessModal
        title="Claimed!"
        rewardLine={`+${claimed.result.claimedAmount} XP`}
        standingLine={`Level ${claimed.result.highestLevelReached} · ${claimed.result.totalXp} XP total`}
        sources={claimed.sources.map((item) => ({
          id: item.id,
          name: item.name,
          detail: item.sourceLabel,
          amount: item.amount,
        }))}
        levelUpPrepared={claimed.result.levelUpPrepared}
        onClose={() => setClaimed(null)}
      />
    );
  }

  if (!accountId) return null;

  return (
    <>
      {!hidePill && pending.count > 0 ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[46] flex justify-center"
          style={{ paddingTop: safePadTop('0.6rem') }}
        >
          <PendingXpReviewPill />
        </div>
      ) : null}

      {open ? (
        <DialogBackdrop
          onClose={closeXpClaimSheet}
          dimClassName="bg-black/60"
          align="end"
          className="px-0"
          ariaLabel="Unclaimed XP"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="xp-overlay-title"
            className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl bg-[#1c1c1e] pb-[env(safe-area-inset-bottom)] shadow-xl"
          >
            <div className="px-6 pt-6">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-lake-blue">
                Unclaimed XP
              </p>
              <p id="xp-overlay-title" className="mt-1 text-[28px] font-bold leading-none text-white">
                +{pending.total} <span className="text-[16px] font-semibold text-white/50">points</span>
              </p>
              <p className="mt-1.5 text-[13px] text-white/45">
                {pending.count} {pending.count === 1 ? 'source' : 'sources'} waiting to be added to
                your total XP and level.
              </p>
            </div>

            <ul className="mx-4 mt-4 max-h-64 space-y-1.5 overflow-y-auto rounded-2xl bg-white/5 p-2">
              {pending.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-white">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {item.sourceLabel} · {formatWhen(item.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-[#5BA3FF]">
                    +{item.amount}
                  </span>
                </li>
              ))}
            </ul>

            <div className="p-4">
              <button
                type="button"
                onClick={handleClaimAll}
                disabled={claiming}
                className="w-full rounded-2xl bg-[#5BA3FF] py-3.5 text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {claiming ? 'Claiming…' : `Claim all +${pending.total} XP`}
              </button>
              <button
                type="button"
                onClick={closeXpClaimSheet}
                className="mt-2 w-full py-2.5 text-[14px] font-medium text-white/45"
              >
                Not now
              </button>
            </div>
          </div>
        </DialogBackdrop>
      ) : null}
    </>
  );
}
