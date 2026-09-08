'use client';

/**
 * PresenceControlsHint — Play / Scout control cheat-sheet that sits above the
 * dock, full-width between the left and right rails. Dock glass chrome; closable.
 */

import { useCallback, useState } from 'react';
import { IconX } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_HOVER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { haptic } from '@/lib/despia/haptics';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

const PLAY_LINES = [
  'Map locked to you',
  'Pinch to zoom on you',
  'Drag to turn the view',
] as const;

const SCOUT_LINES = [
  'Drag to pan the map',
  'Pinch or scroll to zoom',
  'Two fingers / right-drag to turn',
] as const;

const DISMISS_KEY = 'ftlomn.presenceHint.dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

export function PresenceControlsHint({ hidden = false }: { hidden?: boolean }) {
  const { mode } = usePresence();
  const isPlay = mode === 'live';
  const lines = isPlay ? PLAY_LINES : SCOUT_LINES;
  const title = isPlay ? 'Play' : 'Scout';
  const [dismissed, setDismissed] = useState(readDismissed);

  const onClose = useCallback(() => {
    haptic.toggle();
    writeDismissed();
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`w-full transition-[opacity,transform] duration-300 ${
        hidden
          ? 'pointer-events-none translate-y-1 opacity-0'
          : 'pointer-events-auto translate-y-0 opacity-100'
      }`}
      aria-hidden={hidden || undefined}
    >
      <div
        role="status"
        aria-live="polite"
        className={`relative w-full rounded-2xl px-3.5 py-2.5 shadow-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isPlay ? 'text-lake-blue' : 'text-foreground-muted'
            }`}
          >
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss controls tip"
            title="Close"
            className={`-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground-muted transition ${MAP_DOCK_GLASS_HOVER_CLASS} active:scale-95`}
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
        <ul className="mt-1 space-y-0.5 pr-6">
          {lines.map((line) => (
            <li
              key={line}
              className="text-[12px] font-medium leading-snug text-foreground"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
