'use client';

/**
 * Contextual claim moment for a fresh territory unlock — shows immediately
 * after CurrentTerritoryStackController detects new jurisdictions. Unlock XP
 * is written unclaimed (see report_territory_presence), so this modal's
 * "Claim" button is what actually moves it into total_xp/level — it's not
 * just a celebration, it's the confirmation step the account owner takes to
 * accept the XP source. After claim, swaps to the shared Claimed! success.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { haptic } from '@/lib/despia/haptics';
import {
  dequeueTerritoryUnlock,
  getTerritoryUnlockQueueSnapshot,
  subscribeTerritoryUnlockQueue,
  type TerritoryUnlockEvent,
} from '@/features/accountTerritories/store/territoryUnlockStore';
import { claimAllXp, type ClaimXpResult } from '@/features/xp/store/pendingXpStore';
import { wouldXpCrossLevel } from '@/features/xp/store/levelUpStore';
import { XpClaimedSuccessModal } from '@/features/xp/modals/XpClaimedSuccessModal';

const KIND_LABEL: Record<string, string> = {
  district: 'Congressional district',
  county: 'County',
  ctu: 'City / township',
  school_district: 'School district',
  senate_district: 'Senate district',
  house_district: 'House district',
};

/** Stable empty — React 19 requires getServerSnapshot to be referentially equal. */
const EMPTY_UNLOCK_QUEUE: TerritoryUnlockEvent[] = [];

export function TerritoryUnlockModal() {
  const queue = useSyncExternalStore(
    subscribeTerritoryUnlockQueue,
    getTerritoryUnlockQueueSnapshot,
    () => EMPTY_UNLOCK_QUEUE,
  );
  const [active, setActive] = useState<TerritoryUnlockEvent | null>(null);
  const [status, setStatus] = useState<'pending' | 'claiming' | 'claimed'>('pending');
  const [claimResult, setClaimResult] = useState<ClaimXpResult | null>(null);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const next = dequeueTerritoryUnlock();
    if (next) {
      haptic.collect.success();
      setStatus('pending');
      setClaimResult(null);
      setActive(next);
    }
  }, [queue, active]);

  if (!active) return null;

  const primary = active.territories[0];
  const extras = active.territories.slice(1);
  const count = active.territories.length;
  const willLevelUp = wouldXpCrossLevel(active.xpCollected)?.crosses ?? false;

  async function handleClaim() {
    setStatus('claiming');
    const result = await claimAllXp();
    if (result) {
      haptic.collect.success();
      setClaimResult(result);
      setStatus('claimed');
    } else {
      setStatus('pending');
    }
  }

  function handleClose() {
    setActive(null);
    setClaimResult(null);
    setStatus('pending');
  }

  if (status === 'claimed' && claimResult) {
    return (
      <XpClaimedSuccessModal
        title="Claimed!"
        rewardLine={`+${claimResult.claimedAmount} XP`}
        standingLine={`Level ${claimResult.highestLevelReached} · ${claimResult.totalXp} XP total`}
        sources={active.territories.map((t) => ({
          id: `${t.unitKind}-${t.unitId}`,
          name: t.name,
          detail: KIND_LABEL[t.unitKind] ?? t.unitKind,
          amount: t.xpAmount,
        }))}
        levelUpPrepared={claimResult.levelUpPrepared}
        onClose={handleClose}
        ariaLabel="XP claimed"
      />
    );
  }

  return (
    <DialogBackdrop
      onClose={undefined}
      dismissible={false}
      dimClassName="bg-black/60"
      className="px-5"
      ariaLabel="Area unlocked"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="territory-unlock-title"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        <div className="px-6 py-7">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-lake-blue">
            {count === 1 ? 'Area unlocked' : `${count} areas unlocked`}
          </p>
          <p
            id="territory-unlock-title"
            className="mt-2 text-[22px] font-bold leading-snug tracking-tight text-white"
          >
            {primary?.name ?? 'New area'}
          </p>
          {primary ? (
            <p className="mt-1 text-[13px] text-white/50">
              {KIND_LABEL[primary.unitKind] ?? primary.unitKind}
              {count === 1 ? ` · +${primary.xpAmount} XP` : ''}
            </p>
          ) : null}

          {extras.length > 0 ? (
            <ul className="mt-4 max-h-28 space-y-1.5 overflow-y-auto text-left">
              {extras.map((t) => (
                <li
                  key={`${t.unitKind}-${t.unitId}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-[13px] text-white/80"
                >
                  <span>
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className="mt-0.5 block text-[11px] text-white/45">
                      {KIND_LABEL[t.unitKind] ?? t.unitKind}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-white/60">
                    +{t.xpAmount}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-white/45">
              XP available to claim
            </p>
            <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-white">
              +{active.xpCollected}
              <span className="ml-1 text-[14px] font-semibold text-white/50">points</span>
            </p>
            <p className="mt-1.5 text-[12px] text-white/45">
              {willLevelUp
                ? 'Claiming this will push you into a new level'
                : count === 1
                  ? 'Confirm to add it to your total'
                  : active.uniformXp
                    ? `+${active.territories[0]?.xpAmount ?? 0} XP each · confirm to add it to your total`
                    : 'Confirm to add it to your total'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClaim}
          disabled={status === 'claiming'}
          className="w-full border-t border-white/10 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5 disabled:opacity-50"
        >
          {status === 'claiming'
            ? 'Claiming…'
            : willLevelUp
              ? `Claim +${active.xpCollected} XP · Level up`
              : `Claim +${active.xpCollected} XP`}
        </button>
      </div>
    </DialogBackdrop>
  );
}
