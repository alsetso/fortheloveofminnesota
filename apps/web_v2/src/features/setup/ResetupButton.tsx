'use client';

import { useState } from 'react';
import { haptic } from '@/lib/despia/haptics';

const IS_DEV = process.env.NODE_ENV === 'development';

type ResetPhase = 'idle' | 'confirm' | 'wiping' | 'done';

/**
 * ResetupButton — deep-reset the account's game data for re-testing onboarding.
 * DEV ONLY — not rendered in production builds.
 *
 * Two-step confirm:
 *   idle    → "↺ Full reset" link
 *   confirm → inline card showing exactly what gets wiped + Cancel / Wipe buttons
 *   wiping  → in-progress state (API call in flight)
 *   done    → brief success flash, then hard-reload to /setup
 *
 * Wipes: XP, level, passport, collections, sessions, demo progress.
 * Preserved: name, username, photo (onboarded resets → profile card re-confirms avatar).
 */
export function ResetupButton() {
  const [phase, setPhase] = useState<ResetPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!IS_DEV) return null;

  function openConfirm() {
    haptic.play('light');
    setError(null);
    setPhase('confirm');
  }

  function cancel() {
    haptic.play('light');
    setPhase('idle');
    setError(null);
  }

  async function confirmWipe() {
    haptic.play('heavy');
    setPhase('wiping');
    setError(null);

    try {
      const res = await fetch('/api/accounts/resetup', { method: 'POST' });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        setError(json.error ?? 'Something went wrong. Try again.');
        setPhase('confirm');
        return;
      }

      setPhase('done');
      // Hard reload so all auth + account caches are flushed.
      setTimeout(() => {
        window.location.href = '/setup';
      }, 900);
    } catch {
      setError('Network error — check your connection and try again.');
      setPhase('confirm');
    }
  }

  if (phase === 'idle') {
    return (
      <button
        type="button"
        onClick={openConfirm}
        className="pointer-events-auto mx-auto block text-[9.5px] font-medium text-[#5C6670]/70 underline-offset-2 hover:text-red-500 hover:underline transition-colors"
      >
        ↺ Full reset
      </button>
    );
  }

  if (phase === 'done') {
    return (
      <div className="pointer-events-auto rounded-2xl border border-green-700/20 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
        <p className="text-center text-[11px] font-semibold text-green-600">
          ✓ Wiped — reloading…
        </p>
      </div>
    );
  }

  // confirm or wiping
  const isWiping = phase === 'wiping';

  return (
    <div className="pointer-events-auto rounded-2xl border border-red-700/15 bg-white/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="text-[13px] leading-none">⚠️</span>
        <p className="text-[11px] font-bold text-[#1C1C1E]">Reset for Retesting</p>
      </div>

      {/* Wipe list */}
      <ul className="mt-1.5 space-y-0.5">
        {WIPE_ITEMS.map((item) => (
          <li key={item} className="flex items-center gap-1.5">
            <span className="inline-flex h-1 w-1 shrink-0 rounded-full bg-red-400" />
            <span className="text-[10px] text-[#5C6670]">{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-1.5 text-[9.5px] text-[#5C6670]/80">
        Name, username &amp; photo kept — onboarded resets so you re-confirm avatar pick on next load.
      </p>

      {error && (
        <p className="mt-1.5 text-[9.5px] font-medium text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={isWiping}
          className="flex-1 rounded-full border border-black/10 bg-transparent px-3 py-1.5 text-[11px] font-semibold text-[#5C6670] transition hover:bg-black/5 active:scale-95 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirmWipe}
          disabled={isWiping}
          className="flex-[1.4] rounded-full border border-red-700/20 bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition active:scale-95 hover:bg-red-500 disabled:opacity-60"
        >
          {isWiping ? 'Wiping…' : 'Wipe & restart →'}
        </button>
      </div>
    </div>
  );
}

const WIPE_ITEMS = [
  'XP & level (back to Level 1)',
  'Territory passport (all stamps)',
  'Collected items (hearts, coins)',
  'Login streaks & world sessions',
  'Demo progress → Step 1',
  'onboarded → false (profile card re-opens)',
];
