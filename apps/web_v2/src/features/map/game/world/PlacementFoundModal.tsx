'use client';

/**
 * Placement tap card — complete 8-verb modal.
 *
 * ObjectClass drives every display and action decision.
 * The card handles: collectible, discovery, check_in, info, route (stub),
 * unlock (stub), redeem (stub), challenge (stub).
 *
 * Stubs show a clean info-style card until the verb's iOS flow ships.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { haptic } from '@/lib/despia/haptics';
import { invalidateStanding } from '@/lib/standing/invalidateStanding';
import { bumpHeartsCollected } from '@/features/collections/useAccountCollections';
import { invalidateWalletSummary } from '@/features/tools/wallet/useWalletSummary';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import { collectErrorMessage, collectPlacement, type CollectResult } from '@/features/map/game/world/collectApi';
import {
  classifyObject,
  isClaimVerb,
  resolveModelVerb,
} from '@/features/map/game/world/modelVerbs';
import {
  prepareLevelUpFromGrant,
  releaseLevelUpSequence,
  wouldXpCrossLevel,
} from '@/features/xp/store/levelUpStore';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import { placementFoundCopy } from '@/features/map/game/world/placementFoundCopy';
import {
  closeWorldPlacementFound,
  getWorldPlacementFoundState,
  subscribeWorldPlacementFound,
} from '@/features/map/game/world/placementFoundStore';
import {
  isDemoWorldPlacementId,
  removeWorldPlacement,
} from '@/features/map/game/world/placementsStore';
import { markDemoPlacementCollected } from '@/features/setup/seedDemoCollectibles';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';

// ── Helpers ────────────────────────────────────────────────────────────────

type Status = 'idle' | 'collecting' | 'collected' | 'error';

function rewardLine(result: CollectResult): string {
  const { reward } = result;
  const bits: string[] = [];
  if (reward?.type === 'credits') {
    const n = reward.amount ?? 1;
    bits.push(`+${n} credit${n === 1 ? '' : 's'}`);
  } else if (reward?.type === 'hearts') {
    const n = reward.amount ?? 1;
    bits.push(`+${n} heart${n === 1 ? '' : 's'}`);
  } else if (reward?.type === 'loot' && reward.item) {
    bits.push(`Added "${reward.item}"`);
  } else if (reward?.type === 'stat' && reward.key) {
    bits.push(`Logged ${reward.key}`);
  }
  const xp = typeof reward?.xp === 'number' ? reward.xp : 0;
  if (xp > 0) bits.push(`+${xp} XP`);
  if (!bits.length) bits.push('Stamped');
  return bits.join(' · ');
}

// ── Modal ──────────────────────────────────────────────────────────────────

export function PlacementFoundModal() {
  const found = useSyncExternalStore(
    subscribeWorldPlacementFound,
    getWorldPlacementFoundState,
    () => null,
  );
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<CollectResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [levelUpPrepared, setLevelUpPrepared] = useState(false);
  const { coords: liveFix } = useFindMeCoords();

  useEffect(() => {
    setStatus('idle');
    setResult(null);
    setErrorMessage(null);
    setLevelUpPrepared(false);
  }, [found?.featureId]);

  if (!found) return null;

  const copy = placementFoundCopy(found.kind);
  const model = getWorldModel(found.kind);
  const modelUrl = model?.url ?? null;
  const verb = resolveModelVerb(model?.interaction);
  const objectClass = classifyObject(model?.interaction, model?.onCollect);

  // Claim actions (server round-trip required)
  const isClaimable = isClaimVerb(verb);
  const isCollectible = objectClass === 'collectible';   // consumable (coins, hearts)
  const isDiscovery   = objectClass === 'discovery';     // landmark confirm-found
  const isCheckIn     = objectClass === 'check_in';      // visit stamp

  const placementId = String(found.featureId);
  const isUnsynced = placementId.startsWith('local-');
  const isDemo = isDemoWorldPlacementId(placementId);

  const pendingCollectXp =
    typeof model?.reward?.xp === 'number' ? model.reward.xp : 0;
  const willLevelUpOnCollect =
    status === 'idle' && pendingCollectXp > 0 && !isDemo
      ? (wouldXpCrossLevel(pendingCollectXp)?.crosses ?? false)
      : false;

  // ── Claim handler (collectible / discovery / check_in) ────────────────────
  const handleClaim = async () => {
    if (status === 'collecting' || isUnsynced) return;

    // Demo soft-claim: map removal only, no API/XP/hearts/wallet.
    if (isDemo) {
      setStatus('collecting');
      setErrorMessage(null);
      haptic.collect.success();
      if (model?.onCollect !== 'stay') removeWorldPlacement(placementId);
      markDemoPlacementCollected(placementId);
      setResult({
        ok: true,
        placementId,
        modelSlug: found.kind,
        reward: null,
        walletBalance: null,
        xp: { total: 0, level: 1, highestLevelReached: 1 },
      });
      setStatus('collected');
      return;
    }

    setStatus('collecting');
    setErrorMessage(null);

    // Map objectClass → ClaimKind for world_collections.kind
    const claimKind =
      isCheckIn   ? 'check_in'
      : isDiscovery ? 'find'
      : 'collect';

    const res = await collectPlacement(
      placementId,
      liveFix ? { lat: liveFix.lat, lng: liveFix.lng } : undefined,
      claimKind,
    );

    if (!res.ok) {
      haptic.collect.error();
      setStatus('error');
      setErrorMessage(collectErrorMessage(res.code));
      return;
    }

    haptic.collect.success();
    if (model?.onCollect !== 'stay') removeWorldPlacement(placementId);

    if (res.reward?.type === 'credits') invalidateWalletSummary();
    if (found.kind === 'heart-quaternius' || res.reward?.type === 'hearts') {
      bumpHeartsCollected(
        res.reward?.type === 'hearts' ? (res.reward.amount ?? 1) : 1,
      );
    }

    invalidateStanding();
    const prepared = prepareLevelUpFromGrant({
      level: res.xp.highestLevelReached,
      totalXp: res.xp.total,
      xpGained: typeof res.reward?.xp === 'number' ? res.reward.xp : 0,
      source: 'collect',
    });
    setLevelUpPrepared(prepared.prepared);
    setResult(res);
    setStatus('collected');
  };

  const handleClose = () => {
    haptic.toggle();
    const shouldRelease = levelUpPrepared;
    closeWorldPlacementFound();
    if (shouldRelease) releaseLevelUpSequence();
  };

  // ── Success title / body ──────────────────────────────────────────────────
  const successTitle =
    isDemo         ? 'Practice complete'
    : isCollectible ? 'Collected!'
    : isDiscovery   ? 'Found!'
    : isCheckIn     ? 'Checked in!'
    : 'Done';

  const successBody =
    isDemo && result
      ? 'Nothing was saved — no XP, hearts, or credits.'
      : result
        ? rewardLine(result)
        : '';

  // ── Reward preview pill (idle state) ─────────────────────────────────────
  const showRewardPill =
    isCollectible && status === 'idle' && model?.reward && !isDemo;

  // ── CTA button text (claim states) ───────────────────────────────────────
  function claimCta(): string {
    if (isUnsynced)             return 'Saving…';
    if (status === 'collecting') {
      if (isCheckIn)   return 'Checking in…';
      if (isDiscovery) return 'Confirming…';
      return 'Collecting…';
    }
    if (status === 'error')     return 'Try again';
    if (isCheckIn)              return 'Check In';
    if (isDiscovery)            return 'Confirm Found';
    // isCollectible
    return willLevelUpOnCollect ? 'Collect · Level up' : 'Collect';
  }

  // ── Close / single-button label ───────────────────────────────────────────
  const closeCta =
    status === 'collected' && levelUpPrepared ? 'Continue'
    : copy.verb === 'info'                    ? 'Got it'
    : isCollectible && status !== 'collected' ? 'Not now'
    : 'Close';

  return (
    <DialogBackdrop
      onClose={handleClose}
      dismissible={status !== 'collecting'}
      dimClassName="bg-black/50"
      className="px-5"
      ariaLabel={copy.title}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-placement-found-title"
        aria-describedby="world-placement-found-body"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        {/* 3D model preview */}
        {modelUrl ? (
          <WorldModelPreviewCanvas
            url={modelUrl}
            className="h-48 w-full border-b border-white/10 bg-[#121214]"
          />
        ) : null}

        {/* Content */}
        <div className="border-b border-white/10 px-5 py-5">
          <h2
            id="world-placement-found-title"
            className="text-[17px] font-semibold tracking-tight text-white"
          >
            {status === 'collected' ? successTitle : copy.title}
          </h2>

          <p
            id="world-placement-found-body"
            className="mt-2 text-[14px] leading-snug text-white/60"
          >
            {status === 'collected'
              ? successBody
              : status === 'error' && errorMessage
                ? errorMessage
                : isUnsynced
                  ? 'Still saving to the map — try again in a moment.'
                  : isDemo
                    ? "Practice find \u2014 collecting won't add XP, hearts, or credits."
                    : copy.body}
          </p>

          {/* Reward preview (idle, consumable collectible) */}
          {showRewardPill ? (
            <p className="mt-2 text-[12px] text-white/40">
              {model!.rare ? 'Rare find · ' : null}
              {model!.reward!.type === 'hearts'
                ? `+${model!.reward!.amount ?? 1} heart${(model!.reward!.amount ?? 1) === 1 ? '' : 's'}`
                : model!.reward!.type === 'credits'
                  ? `+${model!.reward!.amount ?? 1} credit${(model!.reward!.amount ?? 1) === 1 ? '' : 's'}`
                  : 'Collectible'}
              {model!.reward!.xp ? ` · +${model!.reward!.xp} XP` : null}
            </p>
          ) : null}

          {/* XP / balance after claim */}
          {status === 'collected' && result && !isDemo ? (
            <p className="mt-1 text-[12px] text-white/40">
              {result.reward?.type === 'credits' && result.walletBalance != null
                ? `${result.walletBalance} credit${result.walletBalance === 1 ? '' : 's'} · `
                : null}
              Level {result.xp.highestLevelReached} · {result.xp.total} XP total
            </p>
          ) : null}

          {/* Level-up ready badge */}
          {status === 'collected' && levelUpPrepared ? (
            <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-[#5BA3FF]">
              Level up ready
            </p>
          ) : null}
        </div>

        {/* ── Action footer ──────────────────────────────────────────────── */}

        {/* Claimable: two-button row (Not now / Collect, Close / Confirm, etc.) */}
        {isClaimable && status !== 'collected' ? (
          <div className="flex divide-x divide-white/10">
            <button
              type="button"
              onClick={handleClose}
              disabled={status === 'collecting'}
              className="flex-1 py-3.5 text-[16px] font-medium text-white/60 transition active:bg-white/5 disabled:opacity-40"
            >
              {isCollectible ? 'Not now' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleClaim}
              disabled={status === 'collecting' || isUnsynced}
              className="flex-1 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5 disabled:opacity-60"
            >
              {claimCta()}
            </button>
          </div>

        /* Info with external CTA link */
        ) : copy.verb === 'info' && copy.ctaUrl && status === 'idle' ? (
          <div className="flex divide-x divide-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3.5 text-[16px] font-medium text-white/60 transition active:bg-white/5"
            >
              Close
            </button>
            <a
              href={copy.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic.toggle()}
              className="flex-1 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5"
            >
              {copy.ctaLabel ?? 'Learn more'}
            </a>
          </div>

        /* Single close/done button — info, route stub, unlock/redeem/challenge stubs, post-claim */
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5"
          >
            {closeCta}
          </button>
        )}
      </div>
    </DialogBackdrop>
  );
}
