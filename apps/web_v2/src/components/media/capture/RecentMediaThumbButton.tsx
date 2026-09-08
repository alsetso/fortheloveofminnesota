'use client';

/**
 * Instagram-style recents thumb — used under the camera (ModeSelector) and on
 * the Game map right rail. Shows the newest Recents tile, or a camera glyph.
 */

import { IconCamera } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';

export type RecentMediaThumbButtonProps = {
  thumbUrl?: string | null;
  thumbKind?: 'image' | 'video';
  onClick?: () => void;
  disabled?: boolean;
  /** Extra classes (size / active ring) — defaults match ModeSelector. */
  className?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  title?: string;
};

export default function RecentMediaThumbButton({
  thumbUrl = null,
  thumbKind = 'image',
  onClick,
  disabled = false,
  className = '',
  'aria-label': ariaLabel = 'Open recents',
  'aria-pressed': ariaPressed,
  title = 'Recents',
}: RecentMediaThumbButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        haptic.toggle();
        onClick?.();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      data-rail="camera"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-black/40 shadow-sm transition active:scale-95 disabled:opacity-40 ${className}`}
    >
      {thumbUrl ? (
        thumbKind === 'video' ? (
          <video
            src={thumbUrl}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <IconCamera className="h-4 w-4 text-white" />
      )}
    </button>
  );
}
