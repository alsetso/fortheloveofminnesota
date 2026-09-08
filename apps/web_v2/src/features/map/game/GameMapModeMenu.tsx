'use client';

/**
 * TopBar center control — Play ↔ Scout presence.
 * Trigger sits in the title slot; the open panel renders in TopBar `below`
 * with `belowOverlay` so it drapes over the map instead of resizing it.
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { IconChevronDown } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import {
  getFindMeCoordsSnapshot,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { resolveSpeedTier } from '@/map/location/device/locomotion';
import { usePresence } from '@/map/location/positionMode/usePositionMode';
import { usePlayerPresenceSwitch } from '@/map/location/positionMode/usePlayerPresenceSwitch';
import {
  APP_CONTENT_MAX_WIDTH_PX,
  APP_SHELL_GUTTER_X_CLASS,
} from '@/features/appShell/tabs';

const MODES = [
  {
    id: 'live' as const,
    label: 'Play',
    detail: 'Follow your GPS on the map',
  },
  {
    id: 'scout' as const,
    label: 'Scout',
    detail: 'Roam freely without GPS lock',
  },
];

type ModeId = (typeof MODES)[number]['id'];

export type GameMapModeMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shared listbox id — pass the same value to trigger + panel. */
  listId: string;
};

/** Shared open-state + select helpers for the mode trigger and header panel. */
export function useGameMapModeMenu(onOpenChange: (open: boolean) => void) {
  const listId = useId();
  const { mode: positionMode, notice } = usePresence();
  const { switchToLive, switchToScout, switching } = usePlayerPresenceSwitch();
  const { coords, modeKnown } = useSyncExternalStore(
    subscribeFindMeCoords,
    getFindMeCoordsSnapshot,
    getFindMeCoordsSnapshot,
  );

  const isLive = positionMode === 'live';
  const label = isLive ? 'Play' : 'Scout';

  const speedMps = coords?.speed ?? null;
  const speedMph = speedMps != null ? speedMps * 2.237 : null;
  const showSpeed = isLive && modeKnown && speedMph != null && speedMph > 0.5;
  const speedTier = resolveSpeedTier(speedMps);
  const speedLabel = showSpeed
    ? speedMph! < 20
      ? `${speedMph!.toFixed(1)} mph`
      : `${Math.round(speedMph!)} mph`
    : null;
  const speedClass =
    speedTier === 'vehicle'
      ? 'text-red-500'
      : speedTier === 'moving'
        ? 'text-orange-500'
        : 'text-foreground-muted';

  const select = useCallback(
    (next: ModeId) => {
      if (switching) return;
      onOpenChange(false);
      if (next === 'live' && !isLive) {
        haptic.toggle();
        void switchToLive();
      } else if (next === 'scout' && isLive) {
        haptic.toggle();
        void switchToScout();
      }
    },
    [switching, isLive, switchToLive, switchToScout, onOpenChange],
  );

  return {
    listId,
    isLive,
    label,
    notice,
    switching,
    speedLabel,
    speedClass,
    select,
  };
}

/** Center trigger — Play / Scout pill. */
export function GameMapModeMenu({
  open,
  onOpenChange,
  listId,
  label,
  isLive,
  notice,
  switching,
  speedLabel,
  speedClass,
}: GameMapModeMenuProps & {
  label: string;
  isLive: boolean;
  notice: string | null;
  switching: boolean;
  speedLabel: string | null;
  speedClass: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const panel = document.getElementById(listId);
      if (panel?.contains(target)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange, listId]);

  return (
    <div className="relative flex flex-col items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={switching}
        onClick={() => {
          haptic.toggle();
          onOpenChange(!open);
        }}
        className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 transition active:opacity-70 disabled:opacity-60 ${
          open ? 'bg-black/[0.06]' : 'bg-black/[0.04]'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isLive ? 'bg-blue-500' : 'bg-foreground/35'
          } ${switching ? 'animate-pulse' : ''}`}
        />
        <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {label}
        </span>
        {speedLabel ? (
          <span className={`truncate text-[11px] font-medium tabular-nums ${speedClass}`}>
            {speedLabel}
          </span>
        ) : null}
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {notice && !open ? (
        <p
          role="status"
          className="absolute left-1/2 top-[calc(100%+0.25rem)] z-40 w-[14rem] -translate-x-1/2 rounded-xl border border-black/[0.08] bg-[#f7f5f1] px-2.5 py-1.5 text-center text-[10px] font-medium leading-snug text-foreground-muted shadow-sm"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Header extension panel — render in TopBar `below` (+ `belowOverlay` on map).
 * Same surface as the header; no card chrome or gap.
 * Visibility is driven by TopBar `belowCollapsed`, not by unmounting.
 */
export function GameMapModeMenuPanel({
  listId,
  isLive,
  select,
}: {
  listId: string;
  isLive: boolean;
  select: (next: ModeId) => void;
}) {
  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Map mode"
      className="border-b border-black/[0.08] pb-1.5 pt-0.5"
    >
      <div
        className={`mx-auto w-full ${APP_SHELL_GUTTER_X_CLASS}`}
        style={{ maxWidth: APP_CONTENT_MAX_WIDTH_PX }}
      >
        <div className="mx-auto flex w-full max-w-[16rem] flex-col">
          {MODES.map((mode) => {
            const selected = mode.id === (isLive ? 'live' : 'scout');
            return (
              <button
                key={mode.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => select(mode.id)}
                className={`flex w-full flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-center transition-colors active:bg-black/[0.04] ${
                  selected ? 'bg-black/[0.04]' : ''
                }`}
              >
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      mode.id === 'live' ? 'bg-blue-500' : 'bg-foreground/35'
                    }`}
                  />
                  {mode.label}
                </span>
                <span className="text-[11px] leading-snug text-foreground-muted">
                  {mode.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
