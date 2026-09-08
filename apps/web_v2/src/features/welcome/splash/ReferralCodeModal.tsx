'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '@/lib/despia/haptics';
import { safePadBottomKeyboard, safePadTop } from '@/lib/despia/safeArea';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export type RedeemReward = { xpGranted: number; creditsGranted: number };

export type ReferralCodeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Async handler — throw to surface an error message. Returns reward summary on success. */
  onSubmit: (code: string) => Promise<RedeemReward | void>;
  /**
   * Called after the success display completes (same moment as onClose).
   * Use this to trigger post-redemption navigation (e.g. enter the map).
   */
  onSuccess?: () => void;
};

const INK = '#FFFaf5';
const MUTED = 'rgba(255, 250, 245, 0.72)';
const ACCENT = '#E8F0E8';
const DARK_SCRIM = 'rgba(14, 20, 15, 0.88)';

/**
 * Referral code redemption sheet — rises over the splash background as a
 * centered card with a dark scrim. Keyboard-aware bottom padding.
 */
export default function ReferralCodeModal({
  open,
  onClose,
  onSubmit,
  onSuccess,
}: ReferralCodeModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [reward, setReward] = useState<RedeemReward | null>(null);
  const [visible, setVisible] = useState(false);

  // Mount/unmount with a fade-in transition.
  useEffect(() => {
    if (open) {
      setVisible(true);
      setCode('');
      setSubmitState('idle');
      setErrorMsg('');
      setReward(null);
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisible(false), 260);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  const canSubmit = code.trim().length > 0 && submitState !== 'submitting';

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg('Enter a referral code to continue.');
      return;
    }
    haptic.toggle();
    setSubmitState('submitting');
    setErrorMsg('');
    try {
      const result = await onSubmit(trimmed);
      setReward(result ?? null);
      setSubmitState('success');
      haptic.toggle();
      setTimeout(() => {
        onClose();
        onSuccess?.();
        setSubmitState('idle');
      }, 1800);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "That code isn't valid or has already been used.";
      setErrorMsg(msg);
      setSubmitState('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex flex-col items-center justify-end"
      style={{
        backgroundColor: DARK_SCRIM,
        opacity: open ? 1 : 0,
        transition: 'opacity 0.26s ease-out',
        paddingTop: safePadTop('1rem'),
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Redeem referral code"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          haptic.toggle();
          onClose();
        }
      }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-t-3xl px-6 pt-7"
        style={{
          paddingBottom: safePadBottomKeyboard('1.5rem'),
          backgroundColor: 'rgba(22, 32, 24, 0.97)',
          borderTop: '1px solid rgba(255, 250, 245, 0.10)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag pill */}
        <div className="mb-6 flex justify-center">
          <div
            className="h-1 w-10 rounded-full"
            style={{ backgroundColor: 'rgba(255, 250, 245, 0.22)' }}
          />
        </div>

        {/* Header */}
        <h2
          className="mb-1 text-[1.25rem] font-semibold leading-snug tracking-tight"
          style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}
        >
          Redeem a Referral Code
        </h2>
        <p className="mb-6 text-[0.875rem] leading-relaxed" style={{ color: MUTED }}>
          Have a code from a friend or partner? Enter it below to unlock your invite.
        </p>

        {/* Input */}
        <div className="relative mb-3">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. MN-FRIEND-2026"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (submitState === 'error') setSubmitState('idle');
            }}
            onKeyDown={handleKeyDown}
            disabled={submitState === 'submitting' || submitState === 'success'}
            className="w-full rounded-xl px-4 py-3.5 text-[1rem] font-medium tracking-widest outline-none transition disabled:opacity-50"
            style={{
              backgroundColor: 'rgba(255, 250, 245, 0.07)',
              border: `1.5px solid ${
                submitState === 'error'
                  ? 'rgba(220, 100, 80, 0.65)'
                  : submitState === 'success'
                    ? 'rgba(120, 200, 140, 0.65)'
                    : 'rgba(255, 250, 245, 0.15)'
              }`,
              color: INK,
              caretColor: ACCENT,
            }}
          />
        </div>

        {/* Error / success feedback */}
        <div
          className="mb-4 min-h-[1.25rem] text-[0.8125rem] leading-snug"
          style={{
            color:
              submitState === 'success'
                ? 'rgba(120, 200, 140, 0.92)'
                : 'rgba(220, 100, 80, 0.92)',
          }}
          aria-live="polite"
        >
          {submitState === 'success'
            ? reward && (reward.xpGranted > 0 || reward.creditsGranted > 0)
              ? [
                  reward.xpGranted > 0 && `+${reward.xpGranted.toLocaleString()} XP`,
                  reward.creditsGranted > 0 && `+${reward.creditsGranted.toLocaleString()} credits`,
                ]
                  .filter(Boolean)
                  .join(' & ') + ' — welcome to the community! ✓'
              : '✓ Code redeemed — welcome to the community!'
            : errorMsg}
        </div>

        {/* Submit */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="mb-3 w-full rounded-xl py-3.5 text-[1rem] font-semibold transition active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: ACCENT,
            color: '#1a2b1c',
          }}
        >
          {submitState === 'submitting' ? 'Redeeming…' : 'Redeem Code'}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onClose();
          }}
          className="w-full py-2.5 text-[0.9375rem]"
          style={{ color: MUTED }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
