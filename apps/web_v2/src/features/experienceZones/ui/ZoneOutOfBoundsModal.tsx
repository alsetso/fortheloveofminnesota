'use client';

/**
 * Fires when the user taps outside the active experience zone boundary while
 * Explore Zone is on and tries to drop a pin.
 *
 * Actions:
 *   "Leave Zone"  — exits Explore Zone, runs the stored onLeave callback
 *                   (which drops the pin / opens the contribute sheet).
 *   "Cancel"      — stays in zone, dismisses without any change.
 */

import { createPortal } from 'react-dom';
import { haptic } from '@/lib/despia/haptics';
import { stopExploreZone } from '@/features/experienceZones/store/venueModeStore';
import {
  closeZoneOutOfBounds,
  useZoneOutOfBounds,
} from '@/features/experienceZones/store/zoneOutOfBoundsStore';

export function ZoneOutOfBoundsModal() {
  const { open, zoneName, onLeave } = useZoneOutOfBounds();

  if (!open || typeof document === 'undefined') return null;

  const handleLeave = () => {
    haptic.toggle();
    stopExploreZone();
    closeZoneOutOfBounds();
    onLeave?.();
  };

  const handleCancel = () => {
    haptic.toggle();
    closeZoneOutOfBounds();
  };

  return createPortal(
    /* Backdrop */
    <div
      role="presentation"
      className="fixed inset-0 z-[9000] flex items-end justify-center px-4 pb-10"
      style={{ background: 'rgba(0,0,0,0.52)' }}
      onClick={handleCancel}
    >
      {/* Sheet card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-oob-title"
        aria-describedby="zone-oob-body"
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#1C1C1E] text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex items-center justify-center pt-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-violet-400"
              aria-hidden
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>

        <div className="px-6 pb-6 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-400/80">
            {zoneName ?? 'Experience zone'}
          </p>
          <h2
            id="zone-oob-title"
            className="mt-1.5 text-[18px] font-bold tracking-tight text-white"
          >
            Outside your zone
          </h2>
          <p
            id="zone-oob-body"
            className="mt-2 text-[13px] leading-snug text-white/55"
          >
            Move inside{zoneName ? ` ${zoneName}` : ' the zone'} to drop a pin
            here, or leave the zone to contribute anywhere in Minnesota.
          </p>

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleLeave}
              className="w-full rounded-full bg-white/10 px-4 py-3 text-[14px] font-semibold text-white/90 transition active:scale-95 hover:bg-white/15"
            >
              Leave zone
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full rounded-full bg-violet-600 px-4 py-3 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)] transition active:scale-95 hover:bg-violet-500"
            >
              Stay in zone
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
