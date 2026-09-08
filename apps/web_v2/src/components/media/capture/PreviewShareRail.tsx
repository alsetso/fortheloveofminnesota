'use client';

import { IconMapPin } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';

export type PreviewShareRailProps = {
  onAddLocation: () => void;
  onSend: () => void;
  locationLabel?: string | null;
  sendDisabled?: boolean;
  /**
   * When provided, renders a pill label instead of the bare arrow icon so
   * the intent is clear (e.g. "Add to Post" vs a generic "Send" arrow).
   */
  sendLabel?: string;
};

/** Bottom rail while reviewing a capture — location left, send right. */
export default function PreviewShareRail({
  onAddLocation,
  onSend,
  locationLabel = null,
  sendDisabled = false,
  sendLabel,
}: PreviewShareRailProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        disabled={sendDisabled}
        onClick={() => {
          haptic.toggle();
          onAddLocation();
        }}
        className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.12] px-3.5 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-40"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <IconMapPin className="h-4 w-4" />
        </span>
        <span className="truncate text-[14px] font-semibold text-white">
          {locationLabel?.trim() || 'Add location'}
        </span>
      </button>

      {sendLabel ? (
        /* Pill variant — context makes the action clear (e.g. "Add to Post"). */
        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => {
            haptic.findMe.success();
            onSend();
          }}
          aria-label={sendLabel}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-lake-blue px-5 text-[14px] font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
        >
          {sendLabel}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M5 12h12M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        /* Default circular arrow — generic share / publish. */
        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => {
            haptic.findMe.success();
            onSend();
          }}
          aria-label="Send"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lake-blue text-white shadow-sm transition active:scale-95 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M5 12h12M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
