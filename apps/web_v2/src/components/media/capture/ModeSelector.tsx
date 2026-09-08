'use client';

import RecentMediaThumbButton from '@/components/media/capture/RecentMediaThumbButton';
import { haptic } from '@/lib/despia/haptics';

export type MediaCaptureMode = 'post' | 'story';

const MODES: { id: MediaCaptureMode; label: string }[] = [
  { id: 'post', label: 'POST' },
  { id: 'story', label: 'STORY' },
];

/**
 * Horizontal mode tabs under the camera card.
 * Recent thumb sits on the left of this rail (Instagram-style).
 * STORY stays on camera; POST asks the parent to open the white compose sheet.
 */
export default function ModeSelector({
  value,
  onChange,
  recentThumbUrl = null,
  recentThumbKind = 'image',
  onOpenRecents,
}: {
  value: MediaCaptureMode;
  onChange: (next: MediaCaptureMode) => void;
  recentThumbUrl?: string | null;
  recentThumbKind?: 'image' | 'video';
  onOpenRecents?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 pb-1 pt-3">
      <RecentMediaThumbButton
        thumbUrl={recentThumbUrl}
        thumbKind={recentThumbKind}
        onClick={onOpenRecents}
        aria-label="Open recents"
        title="Recents"
      />

      <div
        role="tablist"
        aria-label="Capture mode"
        className="flex min-w-0 flex-1 items-center justify-center gap-5"
      >
        {MODES.map((mode) => {
          const active = mode.id === value;
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                haptic.toggle();
                onChange(mode.id);
              }}
              className={`text-[13px] font-semibold tracking-[0.06em] transition-colors ${
                active ? 'scale-110 text-white' : 'text-white/40'
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Balance the left thumb so mode labels stay centered. */}
      <span className="inline-flex h-11 w-11 shrink-0" aria-hidden />
    </div>
  );
}
