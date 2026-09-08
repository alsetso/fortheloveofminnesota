'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useObjectRadarStore } from '@/features/map/game/objectRadar/objectRadarStore';
import {
  MAP_DOCK_CIRCLE_SIZE_CLASS,
  MAP_DOCK_COLUMN_GUTTER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { IconLayers, IconX } from '@/features/map/dockCore/core/icons';
import { railActiveClass, railIdleClass } from '@/features/map/dockCore/core/railChrome';
import { haptic } from '@/lib/despia/haptics';
import { safePadTop, safePadBottom } from '@/lib/despia/safeArea';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import {
  demoShowsMinimap,
  useDemoMapChrome,
} from '@/features/setup/DemoMapChromeContext';
import { ObjectMiniMap } from '@/features/map/game/objectRadar';
import { ExperienceZoneBanner } from '@/features/experienceZones/ui/ExperienceZoneBanner';
import { PresenceControlsHint } from '@/features/map/game/PresenceControlsHint';
import {
  type SpeedTier,
  resolveSpeedTier,
  SPEED_TIER_LABEL,
} from '@/map/location/device/locomotion';
import {
  subscribeFindMeCoords,
  getFindMeCoordsSnapshot,
} from '@/map/location/camera/findMeCoordsStore';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

const BTN_BASE =
  'inline-flex shrink-0 items-center justify-center rounded-full border shadow-lg transition-[background-color,transform,border-color,color] duration-150 active:scale-95';

// ─── Speedometer ──────────────────────────────────────────────────────────────

/** Full-screen speedometer modal. */
function SpeedometerModal({
  speedMps,
  onClose,
}: {
  speedMps: number | null;
  onClose: () => void;
}) {
  const speedMph = speedMps != null ? Math.round(speedMps * 2.237) : 0;
  const tier = resolveSpeedTier(speedMps);
  const isVehicle = tier === 'vehicle';
  const isFast = tier === 'moving';

  const accentColor = isVehicle
    ? 'text-red-400'
    : isFast
    ? 'text-orange-300'
    : 'text-white/80';

  const ringColor = isVehicle
    ? 'border-red-500/70'
    : isFast
    ? 'border-orange-400/60'
    : 'border-white/20';

  const glowStyle = isVehicle
    ? { boxShadow: '0 0 60px rgba(239,68,68,0.25)' }
    : isFast
    ? { boxShadow: '0 0 40px rgba(251,146,60,0.18)' }
    : {};

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Speed: ${speedMph} mph`}
      className={`fixed inset-0 ${Z_LAYER_CLASS.SHEET} flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm`}
      style={{ paddingTop: safePadTop('0') }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close speedometer"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-90"
        style={{ marginTop: safePadTop('0') }}
      >
        <IconX className="h-5 w-5" />
      </button>

      {/* Dial */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex flex-col items-center justify-center rounded-full border-4 bg-black/60 backdrop-blur-md transition-colors duration-500 ${ringColor}`}
        style={{ width: 220, height: 220, ...glowStyle }}
      >
        <span className={`text-[80px] font-black leading-none tabular-nums transition-colors duration-300 ${accentColor}`}>
          {speedMph}
        </span>
        <span className="mt-1 text-[14px] font-bold uppercase tracking-[0.2em] text-white/40">
          mph
        </span>
      </div>

      {/* Tier label */}
      <p
        onClick={(e) => e.stopPropagation()}
        className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50"
      >
      {SPEED_TIER_LABEL[tier]}
      </p>

      {/* Dismiss hint */}
      <p
        className="mt-8 text-[12px] text-white/25"
        style={{ paddingBottom: safePadBottom('1.5rem') }}
      >
        Tap anywhere to close
      </p>
    </div>,
    document.body,
  );
}

/**
 * Circle speedometer in the left rail above the minimap.
 * Hidden with the rest of the rail when the dock is full / overlayed.
 *
 * Ring + number color:
 *   ≥ 50 mph (vehicle) → red
 *   ≥ 6.3 mph (movingFast) → orange
 *   < 6.3 mph → white/dim
 */
function SpeedometerCircle({
  speedMps,
  hidden,
}: {
  speedMps: number | null;
  hidden: boolean;
}) {
  const speedMph = speedMps != null ? Math.round(speedMps * 2.237) : 0;
  const tier = resolveSpeedTier(speedMps);
  const isVehicle = tier === 'vehicle';
  const isFast = tier === 'moving';
  const [modalOpen, setModalOpen] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    if (hidden) return;
    haptic.toggle();
    setPulsed(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsed(false), 600);
    setModalOpen(true);
  }, [hidden]);

  const handleClose = useCallback(() => {
    haptic.toggle();
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (hidden) setModalOpen(false);
  }, [hidden]);

  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  const ringClass = isVehicle
    ? 'border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.35)]'
    : isFast
    ? 'border-orange-400/70 shadow-[0_0_8px_rgba(251,146,60,0.25)]'
    : 'border-white/20 shadow-lg';

  const numClass = isVehicle
    ? 'text-red-400'
    : isFast
    ? 'text-orange-300'
    : 'text-white/80';

  return (
    <>
      <button
        type="button"
        aria-label={`Speed: ${speedMph} mph — tap to expand`}
        aria-expanded={modalOpen}
        onClick={handleTap}
        className={`
          relative h-14 w-14 shrink-0 rounded-full
          bg-black/55 backdrop-blur-md
          flex flex-col items-center justify-center
          transition-[border-width,border-color,box-shadow] duration-300
          active:scale-95
          ${pulsed ? 'border-[5px]' : 'border-2'}
          ${ringClass}
        `}
      >
        {isVehicle && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.12)_0%,transparent_70%)]"
          />
        )}
        <span className={`text-[19px] font-black leading-none tabular-nums transition-colors duration-300 ${numClass}`}>
          {speedMph}
        </span>
        <span className="mt-[2px] text-[8px] font-bold tracking-[0.12em] uppercase text-white/35 transition-colors duration-300">
          mph
        </span>
      </button>

      {modalOpen && (
        <SpeedometerModal speedMps={speedMps} onClose={handleClose} />
      )}
    </>
  );
}

// ─── Rail ─────────────────────────────────────────────────────────────────────

export default function GameMinimapRail() {
  const { snap, mode, pane, dockCard, openDockCard, closeDockCard } = useMapDock();
  const { sheetOpen } = useObjectRadarStore();
  const demo = useDemoMapChrome();
  const stepKey = demo?.stepKey ?? null;
  const { mode: presenceMode } = usePresence();
  const isPlay = presenceMode === 'live';

  const { coords } = useSyncExternalStore(subscribeFindMeCoords, getFindMeCoordsSnapshot, getFindMeCoordsSnapshot);

  // Vehicle speed tier — drives speedometer visibility.
  // The camera is always locked to the user regardless of speed.
  const isVehicle = resolveSpeedTier(coords?.speed ?? null) === 'vehicle';

  const hideControls = sheetOpen || mode === 'card' || mode === 'overlay' || snap === 'full' || pane.id === 'post-compose';
  const hidePanel = demo?.panel
    ? mode === 'overlay' || snap === 'full'
    : hideControls;

  // Play: Object MiniMap + Explore Zone. Scout: map Controls + presence hint.
  const promptMaxClass = 'max-w-[min(13.5rem,calc(100vw-10.5rem))]';
  const showSpeedometer = isVehicle && !hideControls;
  const showMinimapWidget =
    isPlay && demoShowsMinimap(stepKey) && !isVehicle && !hideControls;
  const showMapControls = !isPlay && !hideControls;

  const controlsActive = dockCard === 'controls';
  const handleControls = useCallback(() => {
    haptic.toggle();
    if (controlsActive) closeDockCard();
    else openDockCard('controls');
  }, [controlsActive, closeDockCard, openDockCard]);

  // Controls are Scout-only — close the card if presence flips to Play.
  useEffect(() => {
    if (isPlay && dockCard === 'controls') closeDockCard();
  }, [isPlay, dockCard, closeDockCard]);

  return (
    <div className={`flex items-end justify-between gap-2 ${MAP_DOCK_COLUMN_GUTTER_CLASS}`}>
      <div className={`relative flex min-w-0 flex-1 items-end gap-2.5`}>
        {/* Left widget column — speedometer above minimap; both hide with the dock */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div
            className={`transition-[opacity,transform] duration-300 ${
              showSpeedometer
                ? 'pointer-events-auto opacity-100 scale-100 demo-chrome-in'
                : 'pointer-events-none opacity-0 scale-90 h-0 overflow-hidden'
            }`}
            aria-hidden={!showSpeedometer || undefined}
          >
            <SpeedometerCircle speedMps={coords?.speed ?? null} hidden={!showSpeedometer} />
          </div>

          {/* Minimap: Play only; keep mounted while dock-busy so WebGL host survives */}
          {isPlay && demoShowsMinimap(stepKey) ? (
            <div
              className={`transition-[opacity,transform] duration-300 ${
                showMinimapWidget
                  ? 'pointer-events-auto opacity-100 demo-chrome-in'
                  : 'pointer-events-none opacity-0 h-0 overflow-hidden'
              }`}
              aria-hidden={!showMinimapWidget || undefined}
            >
              <ObjectMiniMap />
            </div>
          ) : null}
        </div>

        {/* Center — Explore Zone on Play; presence hint on Scout */}
        <div
          className={`min-w-0 flex-1 transition-opacity duration-150 ${
            hidePanel ? 'pointer-events-none opacity-0' : ''
          }`}
        >
          {demo?.panel ? (
            <div className={promptMaxClass}>{demo.panel}</div>
          ) : isPlay ? (
            <div className={promptMaxClass}>
              <ExperienceZoneBanner />
            </div>
          ) : (
            <PresenceControlsHint hidden={hideControls} />
          )}
        </div>
      </div>

      {/* Right rail — Controls (Scout only: atlas layers, Find Me prefs, map style) */}
      <div
        className={`flex w-11 shrink-0 flex-col items-center gap-2 transition-[opacity,transform] duration-200 ${
          showMapControls
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-1 opacity-0'
        }`}
        aria-hidden={!showMapControls || undefined}
      >
        <button
          type="button"
          onClick={handleControls}
          aria-label="Map settings"
          aria-pressed={controlsActive}
          title="Controls"
          data-rail="layers"
          className={`${MAP_DOCK_CIRCLE_SIZE_CLASS} ${BTN_BASE} ${
            controlsActive ? railActiveClass() : railIdleClass()
          }`}
        >
          <IconLayers className="h-5 w-5" />
        </button>
      </div>

      <style>{`
        @keyframes demoChromeIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        .demo-chrome-in { animation: demoChromeIn 0.34s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>
    </div>
  );
}
