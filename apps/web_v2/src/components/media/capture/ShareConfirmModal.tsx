'use client';

import { IconMapPin, IconSpinner } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type PostVisibility = 'public' | 'only_me';

export type ShareConfirmModalProps = {
  open: boolean;
  visibility: PostVisibility;
  locationLabel?: string | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Second step before creating a pin from MediaCapture preview. */
export default function ShareConfirmModal({
  open,
  visibility,
  locationLabel = null,
  submitting = false,
  onCancel,
  onConfirm,
}: ShareConfirmModalProps) {
  if (!open) return null;

  const audience =
    visibility === 'only_me' ? 'Only you can see it' : 'Anyone can see it';
  const place = locationLabel?.trim() || 'Selected map pin';

  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex items-center justify-center bg-black/55 px-4`}
      role="presentation"
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-confirm-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2
            id="share-confirm-title"
            className="text-[17px] font-semibold tracking-tight text-white"
          >
            Share this post?
          </h2>
          <p className="mt-2 text-[13px] leading-snug text-white/55">
            You’re sharing this media and location.
          </p>
          <div className="mt-3 space-y-1.5 rounded-xl bg-white/[0.06] px-3 py-2.5 text-left">
            <p className="flex items-start gap-2 text-[12px] leading-snug text-white/80">
              <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" />
              <span className="min-w-0">{place}</span>
            </p>
            <p className="text-[12px] font-medium text-white/65">{audience}</p>
          </div>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            haptic.findMe.success();
            onConfirm();
          }}
          className="flex w-full items-center justify-center gap-2 border-b border-white/10 py-3.5 text-[16px] font-semibold text-[#0A84FF] transition active:bg-white/5 disabled:opacity-40"
        >
          {submitting ? (
            <>
              <IconSpinner className="h-4 w-4 animate-spin" />
              Sharing…
            </>
          ) : (
            'Share'
          )}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            haptic.toggle();
            onCancel();
          }}
          className="w-full py-3.5 text-[16px] font-semibold text-white transition active:bg-white/5 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
