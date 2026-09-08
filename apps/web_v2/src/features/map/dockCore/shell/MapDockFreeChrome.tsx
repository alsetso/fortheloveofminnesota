'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  MAP_DOCK_COLUMN_GUTTER_CLASS,
  MAP_DOCK_FLOATING_CONTROLS_Z,
  MAP_DOCK_LEFT_INSET,
  MAP_DOCK_RIGHT_INSET,
} from '@/features/map/dockCore/core/mapDockTokens';
import { LOCAL_GOV_MAP_CHROME_COLUMN_CLASS } from '@/lib/map/mapChrome';
import { safePadTop } from '@/lib/despia/safeArea';

/**
 * Minimum free-map height before top chrome (toast) hides —
 * avoids colliding with sheet-mounted side rails as the dock rises.
 */
export const MAP_DOCK_FREE_CHROME_MIN_PX = 112;

type MapDockFreeChromeProps = {
  topLeft?: ReactNode;
  /** Centered standing HUD (e.g. Explore stats) — sits across from topLeft / topRight. */
  topCenter?: ReactNode;
  topRight?: ReactNode;
};

/**
 * Free-map chrome frame — area above the dock sheet.
 * `bottom` tracks live `visiblePx` so top-left / top-right slots stay
 * in the same column as the contact-book rail and react while the dock moves.
 */
export default function MapDockFreeChrome({
  topLeft,
  topCenter,
  topRight,
}: MapDockFreeChromeProps) {
  const { visiblePx, snap, mode, dragging } = useMapDock();
  const frameRef = useRef<HTMLDivElement>(null);
  const [freeH, setFreeH] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFreeH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hide when a card/overlay owns the shell, the sheet is full, or free space
  // is too short to host toast without colliding with side rails.
  const hide =
    mode === 'card' ||
    mode === 'overlay' ||
    snap === 'full' ||
    (freeH > 0 && freeH < MAP_DOCK_FREE_CHROME_MIN_PX);

  return (
    <div
      ref={frameRef}
      className={`pointer-events-none absolute inset-x-0 top-0 ${MAP_DOCK_FLOATING_CONTROLS_Z} ${
        dragging ? '' : 'transition-[bottom] duration-[380ms] ease-[cubic-bezier(0.2,0,0,1)]'
      } ${hide ? 'pointer-events-none opacity-0' : ''}`}
      style={
        {
          bottom: `${Math.max(0, visiblePx)}px`,
          paddingTop: safePadTop('0.75rem'),
          paddingLeft: MAP_DOCK_LEFT_INSET,
          paddingRight: MAP_DOCK_RIGHT_INSET,
        } as CSSProperties
      }
      aria-hidden={hide || undefined}
    >
      <div
        className={`flex h-full min-h-0 w-full flex-col ${LOCAL_GOV_MAP_CHROME_COLUMN_CLASS} ${MAP_DOCK_COLUMN_GUTTER_CLASS}`}
      >
        <div className="relative flex items-start justify-between gap-3">
          {/*
            Use opacity — not `hidden` / `invisible`. display:none and
            visibility:hidden zero or freeze WebGL (Object MiniMap goes solid black).
          */}
          <div
            className={`relative z-[1] min-w-0 shrink ${
              hide ? 'pointer-events-none opacity-0' : 'pointer-events-auto'
            }`}
          >
            {topLeft}
          </div>
          {topCenter ? (
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center px-14 ${
                hide ? 'opacity-0' : ''
              }`}
            >
              <div className="pointer-events-auto min-w-0 max-w-[min(100%,420px)]">
                {topCenter}
              </div>
            </div>
          ) : null}
          <div
            className={`relative z-[1] min-w-0 max-w-[min(16.5rem,calc(100%-4.5rem))] shrink ${
              hide ? 'pointer-events-none opacity-0' : 'pointer-events-auto'
            }`}
          >
            {topRight}
          </div>
        </div>
      </div>
    </div>
  );
}
