'use client';

import { useState } from 'react';
import { haptic } from '@/lib/despia/haptics';
import ReferralCodeModal, { type RedeemReward } from './ReferralCodeModal';
import type { BootDestinationKind } from '@/features/welcome/boot/resolveBootDestination';
import SpinningHeartCanvas from '@/components/brand/SpinningHeartCanvas';
import { useLoadingTip } from '@/components/brand/useLoadingTip';
import { SAFE_AREA, safePadTop, safePadBottom } from '@/lib/despia/safeArea';

const INK     = '#FFFaf5';
const MUTED   = 'rgba(255, 250, 245, 0.55)';
const SUBTLE  = 'rgba(255, 250, 245, 0.22)';
const ACCENT  = '#E8F0E8';
const ACCENT_TEXT = '#0F2015';

type SplashScreenProps = {
  status?: string;
  /** 0–1 soft progress for the footer bar. */
  progress?: number;
  /** When true, replaces the progress bar with the primary CTA. */
  readyForEntry?: boolean;
  /** Called when the user taps the primary CTA (welcome / setup). */
  onEnterMap?: () => void;
  /**
   * Called with the submitted referral code.
   * Throw to surface an error message inside the modal.
   * Returns the reward summary on success so the modal can display earned amounts.
   */
  onRedeemReferral?: (code: string) => Promise<RedeemReward | void>;
  /**
   * Called after the referral success display completes.
   * Typically triggers navigation into the map.
   */
  onRedeemSuccess?: () => void;
  /**
 * Where this session is heading after the splash.
 * Drives CTA copy so the button always tells the truth.
 *   world       → "Get Started"  (signed-in ready → /feed)
 *   welcome     → "Get Started"  (anon → /welcome auth)
 *   setup       → "Continue"     (signed-in, incomplete account/demo)
 *   setup_error → "Continue"     (account fetch failed)
 *   stay        → "Get Started"
 */
destinationKind?: BootDestinationKind;
  /**
   * Called when the user taps Sign out (top-right).
   * Shown whenever a session is present — stale iOS auth escape hatch.
   */
  onSignOut?: () => void | Promise<void>;
  /** True when a session exists (even if the account row is still loading). */
  canSignOut?: boolean;
};

/** Derive honest CTA copy from where the user is actually going. */
function ctaForDestination(kind: BootDestinationKind | undefined): {
  label: string;
  subLabel: string | null;
  showReferral: boolean;
} {
  switch (kind) {
    case 'welcome':
      return {
        label: 'Get Started',
        subLabel: 'Create an account to join the community',
        showReferral: false,
      };
    case 'setup':
      return {
        label: 'Continue',
        subLabel: 'Finish setting up your account',
        showReferral: false,
      };
    case 'setup_error':
      return {
        label: 'Continue',
        subLabel: 'Having trouble loading your profile',
        showReferral: false,
      };
    case 'world':
    default:
      return {
        label: 'Get Started',
        subLabel: null,
        showReferral: false,
      };
  }
}

export default function SplashScreen({
  status = 'Loading…',
  progress = 0.12,
  readyForEntry = false,
  onEnterMap,
  onRedeemReferral,
  onRedeemSuccess,
  destinationKind,
  onSignOut,
  canSignOut = false,
}: SplashScreenProps) {
  const [referralOpen, setReferralOpen] = useState(false);
  const tip = useLoadingTip();

  const bar = Math.max(0.06, Math.min(1, progress));
  const handleRedeemReferral = onRedeemReferral ?? (() => Promise.resolve());
  const cta = ctaForDestination(destinationKind);
  const showSignOut = onSignOut != null && canSignOut;

  const handleEnterTap = () => {
    haptic.play('heavy');
    onEnterMap?.();
  };

  return (
    <div
      className="fixed inset-0 z-[99] flex flex-col"
      style={{ backgroundColor: '#0B0D10' }}
      aria-label="Loading For the Love of Minnesota"
      role="status"
      aria-live="polite"
    >
      {/* Safe area top */}
      <div style={{ flexShrink: 0, height: safePadTop('0px') }} aria-hidden />

      {showSignOut ? (
        <div
          className="absolute z-[1]"
          style={{
            top: safePadTop('0.75rem'),
            right: `calc(1.25rem + ${SAFE_AREA.right})`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              haptic.play('light');
              void onSignOut?.();
            }}
            className="text-[13px] font-medium underline underline-offset-2"
            style={{ color: SUBTLE }}
          >
            Sign out
          </button>
        </div>
      ) : null}

      {/* ── Center stage — heart + brand ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5">
        <div className="splash-fade-up flex flex-col items-center text-center">
          {/* Heart with ambient glow */}
          <div className="relative mb-2 flex items-center justify-center">
            <div
              aria-hidden
              className="absolute rounded-full"
              style={{
                width: 176,
                height: 176,
                background: 'radial-gradient(circle, rgba(248,113,113,0.22) 0%, transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <SpinningHeartCanvas className="relative" style={{ width: 144, height: 144 }} />
          </div>

          <p
            className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: SUBTLE }}
          >
            For the Love of Minnesota
          </p>

          <h1
            className="mt-5 max-w-[17rem] text-[1.55rem] font-semibold leading-snug tracking-tight"
            style={{
              color: INK,
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
            }}
          >
            Stand together.<br />Work together.
          </h1>

          <p className="mt-3 max-w-[15rem] text-[0.9375rem] leading-relaxed" style={{ color: MUTED }}>
            Share resources.
          </p>

          {!readyForEntry ? (
            <p
              className="mt-8 max-w-[19rem] text-center text-[0.8125rem] leading-snug"
              style={{ color: MUTED }}
            >
              <span
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: SUBTLE }}
              >
                Tip
              </span>
              {tip}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Footer — progress / CTA ── */}
      <div
        className="relative flex shrink-0 flex-col items-center gap-3 px-5 pb-4 pt-12"
      >
        {/* Loading state */}
        <div
          className="splash-footer-loading flex flex-col items-center gap-3"
          style={{
            opacity: readyForEntry ? 0 : 1,
            pointerEvents: readyForEntry ? 'none' : 'auto',
          }}
          aria-hidden={readyForEntry}
        >
          <div
            className="h-[2px] w-[7.5rem] overflow-hidden rounded-full"
            style={{ backgroundColor: 'rgba(255, 250, 245, 0.10)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(bar * 100)}
            aria-label="Loading progress"
          >
            <div
              className="splash-progress-fill h-full rounded-full"
              style={{ width: `${bar * 100}%`, backgroundColor: ACCENT }}
            />
          </div>
          <p className="flex items-center gap-2.5 text-sm" style={{ color: MUTED }}>
            <span
              className="splash-status-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ACCENT }}
            />
            {status}
          </p>
        </div>

        {/* Enter CTA — springs in when ready */}
        <div
          className="splash-footer-cta absolute inset-x-5 top-4 flex flex-col items-center gap-3"
          style={{
            opacity: readyForEntry ? 1 : 0,
            transform: readyForEntry ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.94)',
            pointerEvents: readyForEntry ? 'auto' : 'none',
          }}
          aria-hidden={!readyForEntry}
        >
          {cta.subLabel && (
            <p className="text-center text-[0.8125rem] leading-snug" style={{ color: MUTED }}>
              {cta.subLabel}
            </p>
          )}

          <button
            type="button"
            onClick={handleEnterTap}
            className="splash-enter-btn relative w-full max-w-[17rem] overflow-hidden rounded-2xl py-4 text-[1.0625rem] font-semibold tracking-tight active:scale-[0.96]"
            style={{
              backgroundColor: ACCENT,
              color: ACCENT_TEXT,
              boxShadow: '0 4px 28px rgba(180,220,190,0.20), 0 1px 4px rgba(0,0,0,0.40)',
            }}
          >
            <span className="relative z-10">{cta.label}</span>
            <span
              aria-hidden
              className="splash-btn-shimmer pointer-events-none absolute inset-y-0 -left-20 w-16 skew-x-[-15deg]"
              style={{
                background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.40) 50%, transparent 100%)',
              }}
            />
          </button>

          {cta.showReferral && (
            <button
              type="button"
              onClick={() => { haptic.toggle(); setReferralOpen(true); }}
              className="flex items-center gap-1.5 text-[0.8125rem]"
              style={{ color: SUBTLE }}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 opacity-70" fill="currentColor" aria-hidden>
                <path d="M13.5 8.5a.5.5 0 0 1 0 1H13v2a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5V9.5h-.5a.5.5 0 0 1 0-1H3v-2A1.5 1.5 0 0 1 4.5 5H5V3.5A1.5 1.5 0 0 1 6.5 2h3A1.5 1.5 0 0 1 11 3.5V5h.5A1.5 1.5 0 0 1 13 6.5v2h.5ZM6.5 5h3V3.5a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 0-.5.5V5Zm-2 1a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5h-7Z" />
              </svg>
              Redeem referral code
            </button>
          )}

        </div>
      </div>

      {/* Safe area bottom */}
      <div style={{ flexShrink: 0, height: safePadBottom('1rem') }} aria-hidden />

      <style>{`
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .splash-fade-up { animation: splashFadeUp 0.55s ease-out both; }

        @keyframes splashStatusDot {
          0%, 100% { opacity: 0.32; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.2); }
        }
        .splash-status-dot { animation: splashStatusDot 1.2s ease-in-out infinite; }

        .splash-progress-fill { transition: width 0.38s ease-out; }

        .splash-footer-loading { transition: opacity 0.28s ease-out; }
        .splash-footer-cta {
          transition:
            opacity   0.42s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s,
            transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s;
        }

        .splash-enter-btn { transition: transform 0.12s ease-out, box-shadow 0.2s ease-out; }

        @keyframes splashBtnShimmer {
          0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateX(350%) skewX(-15deg); opacity: 0; }
        }
        .splash-btn-shimmer { animation: splashBtnShimmer 1.1s ease-in-out 0.65s both; }
      `}</style>

      <ReferralCodeModal
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        onSubmit={handleRedeemReferral}
        onSuccess={onRedeemSuccess}
      />
    </div>
  );
}
