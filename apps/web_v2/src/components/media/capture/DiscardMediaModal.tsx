'use client';

import { haptic } from '@/lib/despia/haptics';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type DiscardMediaModalProps = {
  open: boolean;
  onDiscard: () => void;
  onSaveDraft: () => void;
  onKeepEditing: () => void;
  /**
   * Video has CSS text overlays that Recents cannot store yet.
   * Warn before Save draft so the user knows text won’t be kept.
   */
  videoTextNotSaved?: boolean;
};

/** Confirm leaving a captured preview — Discard / Save draft / Keep editing. */
export default function DiscardMediaModal({
  open,
  onDiscard,
  onSaveDraft,
  onKeepEditing,
  videoTextNotSaved = false,
}: DiscardMediaModalProps) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex items-center justify-center bg-black/55 px-4`}
      role="presentation"
      onClick={onKeepEditing}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-media-title"
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#1c1c1e] text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2
            id="discard-media-title"
            className="text-[17px] font-semibold tracking-tight text-white"
          >
            Discard media?
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-white/55">
            If you go back now, you will lose this photo or video.
          </p>
          {videoTextNotSaved ? (
            <p
              className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2.5 text-[12px] leading-snug text-amber-200"
              role="status"
            >
              Text on this video won&apos;t be saved to Recents yet — only the
              clip will be kept. Keep editing if you still need the text, or
              Share to publish it with the post.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onDiscard();
          }}
          className="w-full border-b border-white/10 py-3.5 text-[16px] font-semibold text-red-400 transition active:bg-white/5"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onSaveDraft();
          }}
          className="w-full border-b border-white/10 py-3.5 text-[16px] font-semibold text-white transition active:bg-white/5"
        >
          {videoTextNotSaved ? 'Save draft without text' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onKeepEditing();
          }}
          className="w-full py-3.5 text-[16px] font-semibold text-white transition active:bg-white/5"
        >
          Keep editing
        </button>
      </div>
    </div>
  );
}
