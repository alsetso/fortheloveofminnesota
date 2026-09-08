'use client';

/**
 * Level Up Ceremony — independent confirmation lightbox that overlays the
 * Pending XP sheet / XP Receipt after Continue. Plays one step at a time:
 *   1. fill   — bar of the old level races to 100%
 *   2. cross  — level number flips to the new level
 *   3. settle — bar of the new level fills to current progress in that band
 *   4. Confirm — required tap before the next queued step (or dismiss)
 *
 * Multi-level grants enqueue 1→2, then 2→3, etc. Each requires Confirm.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import { haptic } from '@/lib/despia/haptics';
import { getLevelTier } from '@/features/xp/logic/levelTiers';
import {
  dequeueLevelUp,
  getLevelUpQueueSnapshot,
  subscribeLevelUpQueue,
  type LevelUpEvent,
} from '@/features/xp/store/levelUpStore';
import {
  progressInLevel,
  xpIntoLevel,
  xpSpanForLevel,
} from '@/features/xp/logic/xpCurve';

type Step = 'fill' | 'cross' | 'settle' | 'confirm';

const FILL_MS = 1100;
const CROSS_MS = 850;
const SETTLE_MS = 1000;
/** Stable empty — React 19 requires getServerSnapshot to be referentially equal. */
const EMPTY_LEVEL_UP_QUEUE: LevelUpEvent[] = [];

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function eventKey(event: LevelUpEvent): string {
  return `${event.from}->${event.to}:${event.previousTotalXp}->${event.totalXp}:${event.source}`;
}

export function LevelUpSequence() {
  const queue = useSyncExternalStore(
    subscribeLevelUpQueue,
    getLevelUpQueueSnapshot,
    () => EMPTY_LEVEL_UP_QUEUE,
  );
  // Peek — never dequeue in an effect (Strict Mode safe). Confirm advances.
  const active = queue[0] ?? null;
  const [step, setStep] = useState<Step>('fill');
  const [displayLevel, setDisplayLevel] = useState(1);
  const [barPct, setBarPct] = useState(0);
  const [barReady, setBarReady] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Start / restart the ceremony whenever the head of the queue changes.
  useEffect(() => {
    if (!active) {
      setPlayingKey(null);
      return;
    }
    const key = eventKey(active);
    if (playingKey === key) return;

    haptic.collect.success();
    const startPct = clampPct(
      progressInLevel(active.previousTotalXp, active.from, active.xpCeiling, active.xpCurveExponent) *
        100,
    );
    setPlayingKey(key);
    setStep('fill');
    setDisplayLevel(active.from);
    setBarReady(false);
    setBarPct(startPct);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBarReady(true);
        setBarPct(100);
      });
    });
  }, [active, playingKey]);

  useEffect(() => {
    if (!active || step === 'confirm') return;
    const ceiling = active.xpCeiling;
    let timer: number | undefined;

    if (step === 'fill') {
      timer = window.setTimeout(() => {
        haptic.collect.success();
        setStep('cross');
        setDisplayLevel(active.to);
      }, FILL_MS);
    } else if (step === 'cross') {
      timer = window.setTimeout(() => {
        const endPct = clampPct(
          progressInLevel(active.totalXp, active.to, ceiling, active.xpCurveExponent) * 100,
        );
        setStep('settle');
        setBarReady(false);
        setBarPct(0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setBarReady(true);
            setBarPct(endPct);
          });
        });
      }, CROSS_MS);
    } else if (step === 'settle') {
      timer = window.setTimeout(() => {
        haptic.collect.success();
        setStep('confirm');
      }, SETTLE_MS);
    }

    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [active, step]);

  if (!active) return null;

  const remainingAfterThis = Math.max(0, queue.length - 1);
  const ceiling = active.xpCeiling;
  const tier = getLevelTier(displayLevel);
  const into =
    step === 'fill'
      ? xpIntoLevel(active.previousTotalXp, active.from, ceiling, active.xpCurveExponent)
      : xpIntoLevel(active.totalXp, active.to, ceiling, active.xpCurveExponent);
  const span =
    step === 'fill'
      ? xpSpanForLevel(active.from, ceiling, active.xpCurveExponent)
      : xpSpanForLevel(active.to, ceiling, active.xpCurveExponent);
  const labelLevel = step === 'fill' ? active.from : active.to;
  const nextLevelLabel = Math.min(99, labelLevel + 1);

  const eyebrow =
    step === 'fill'
      ? 'Level up'
      : step === 'cross'
        ? 'New level'
        : step === 'settle'
          ? 'Progress'
          : 'Confirm';

  const subtitle =
    step === 'fill'
      ? `+${active.xpGained} XP pushing past Level ${active.from}`
      : step === 'cross'
        ? `You're now a ${tier.name}`
        : step === 'settle'
          ? `${into} / ${span} XP toward Level ${nextLevelLabel}`
          : remainingAfterThis > 0
            ? `Level ${active.from} → ${active.to} · ${remainingAfterThis} more to confirm`
            : `Level ${active.from} → ${active.to} · ${tier.name}`;

  function handleConfirm() {
    haptic.collect.success();
    setPlayingKey(null);
    setStep('fill');
    dequeueLevelUp();
  }

  return (
    <DialogBackdrop
      onClose={undefined}
      dismissible={false}
      dimClassName="bg-black/70"
      className="px-5"
      ariaLabel="Level up ceremony"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-sequence-title"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
      >
        <div className="px-6 py-8">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-lake-blue">
            {eyebrow}
          </p>

          <p
            id="level-up-sequence-title"
            className={`mt-3 font-bold leading-none tabular-nums text-white transition-all duration-500 ${
              step === 'cross' ? 'scale-110 text-[48px]' : 'scale-100 text-[42px]'
            }`}
          >
            {step === 'cross' || step === 'settle' || step === 'confirm' ? (
              <>
                <span className="text-white/35">{active.from}</span>
                <span className="mx-2 text-[22px] font-semibold text-white/40">→</span>
                <span>{active.to}</span>
              </>
            ) : (
              displayLevel
            )}
          </p>

          <p className="mt-2 text-[14px] font-medium text-white/55">{tier.name}</p>
          <p className="mt-3 text-[13px] leading-snug text-white/45">{subtitle}</p>

          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-white/40">
              <span>Level {labelLevel}</span>
              <span className="tabular-nums">
                {step === 'fill' && barPct >= 99
                  ? 'MAX'
                  : `${Math.round(into)} / ${span} XP`}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
              <span
                className={`block h-full rounded-full bg-[#5BA3FF] ${
                  barReady
                    ? 'transition-[width] duration-[1100ms] ease-out'
                    : 'transition-none'
                } ${step === 'cross' ? 'shadow-[0_0_18px_rgba(91,163,255,0.65)]' : ''}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            {step === 'settle' || step === 'confirm' ? (
              <p className="mt-2 text-[12px] tabular-nums text-white/40">
                {active.totalXp} XP total
                {active.xpGained > 0 ? ` · +${active.xpGained} this climb` : ''}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            {(['fill', 'cross', 'settle', 'confirm'] as const).map((s) => {
              const order = { fill: 0, cross: 1, settle: 2, confirm: 3 } as const;
              const activeOrder = order[step];
              const lit = activeOrder >= order[s];
              return (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    lit ? 'w-5 bg-[#5BA3FF]' : 'w-1.5 bg-white/20'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {step === 'confirm' ? (
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full border-t border-white/10 py-3.5 text-[16px] font-semibold text-[#5BA3FF] transition active:bg-white/5"
          >
            {remainingAfterThis > 0 ? 'Confirm · Next level' : 'Confirm'}
          </button>
        ) : (
          <div className="border-t border-white/10 py-3.5 text-[13px] font-medium text-white/35">
            {step === 'fill'
              ? 'Crossing the limit…'
              : step === 'cross'
                ? 'Level changing…'
                : 'Locking in progress…'}
          </div>
        )}
      </div>
    </DialogBackdrop>
  );
}
