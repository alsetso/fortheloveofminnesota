'use client';

/**
 * Listens for real GameDock interactions during /setup demo and fires
 * `onInteraction` once per step.
 *
 * Steps (0-indexed, matching DEMO_STEPS array):
 *  0  find_me            — tap [data-rail="locate"]
 *  1  claim_streak       — DemoStreakClaimChip fires onInteraction directly on Claim tap
 *  2  zoom_map           — user pinch/double-tap: zoom delta > 0.6 (originalEvent required)
 *  3  rotate_map         — user drag: bearing delta > 12° (originalEvent required)
 *  4  open_minimap       — ObjectRadar sheetOpen rising edge
 *  5  tap_hud            — tap any [data-hud] stat button
 *  6  unlock_territories — DemoTerritoryUnlockChip fires onInteraction after claim
 *  7  collect_heart      — DEMO_HEART_ID marked collected
 *  8  collect_coin       — DEMO_COIN_ID marked collected
 *  9  select_point       — new selected-point coords
 */

import { useEffect, useRef } from 'react';
import { useObjectRadarStore } from '@/features/map/game/objectRadar/objectRadarStore';
import {
  clearDemoWorldPlacements,
  getDemoCollectProgress,
  resetDemoCollectProgress,
  seedDemoHeartNear,
  seedDemoCoinNear,
  subscribeDemoCollectProgress,
} from '@/features/setup/seedDemoCollectibles';
import type { DemoStepKey } from '@/features/setup/demoSteps';
import { useMapContext } from '@/map';
import { subscribeFindMeCoords, getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import {
  getSelectedPointCoordsSnapshot,
  subscribeSelectedPointCoords,
} from '@/map/location/camera/selectedPointCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { setDemoSelectedPointBlocked } from '@/features/setup/demoSelectedPointGate';

export type DemoInteractionBridgeProps = {
  stepKey: DemoStepKey;
  onInteraction: () => void;
};

function resolveDemoSeedCoords() {
  const live = getFindMeCoordsSnapshot();
  return live.coords ?? live.lookupCoords ?? getFindMeLastCoords();
}


export function DemoInteractionBridge({
  stepKey,
  onInteraction,
}: DemoInteractionBridgeProps) {
  const { map, ready } = useMapContext();
  const { sheetOpen } = useObjectRadarStore();
  const firedRef            = useRef(false);
  const onInteractionRef    = useRef(onInteraction);
  onInteractionRef.current  = onInteraction;

  const sheetWasOpenRef     = useRef(false);
  const hadSelectedPointRef = useRef(false);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onInteractionRef.current();
  };

  // Reset edge guards on each new step.
  useEffect(() => {
    firedRef.current            = false;
    sheetWasOpenRef.current     = sheetOpen;
    hadSelectedPointRef.current = getSelectedPointCoordsSnapshot().coords != null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // Gate the dock from opening on accidental map taps until the select_point step.
  // Cleared on unmount so production /game is never affected.
  useEffect(() => {
    setDemoSelectedPointBlocked(stepKey !== 'select_point');
    return () => setDemoSelectedPointBlocked(false);
  }, [stepKey]);

  // ── 0: Find Me ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'find_me') return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-rail="locate"]')) fire();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [stepKey]);

  // ── 1: Claim Streak ───────────────────────────────────────────────────────
  // DemoStreakClaimChip owns this step — fires onInteraction on Claim tap.

  // ── 2: Zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'zoom_map' || !map || !ready) return;
    let baseZoom: number | null = null;
    const onZoom = (e: { originalEvent?: Event }) => {
      // Ignore programmatic camera moves (FindMe fly-to, easeTo) — only user gestures.
      if (!e.originalEvent) return;
      if (baseZoom === null) { baseZoom = map.getZoom(); return; }
      if (Math.abs(map.getZoom() - baseZoom) > 0.6) fire();
    };
    map.on('zoom', onZoom as any);
    return () => { map.off('zoom', onZoom as any); };
  }, [stepKey, map, ready]);

  // ── 3: Rotate ─────────────────────────────────────────────────────────────
  // Detect a deliberate left-or-right swipe on the map canvas (≥40px).
  // The one-finger orbit gesture fires Mapbox via map.easeTo/setBearing
  // (programmatic), so originalEvent is always undefined — canvas pointer
  // events are the only reliable signal.
  useEffect(() => {
    if (stepKey !== 'rotate_map' || !map || !ready) return;
    const canvas = map.getCanvas();
    let startX: number | null = null;

    const onDown  = (e: PointerEvent) => { startX = e.clientX; };
    const onMove  = (e: PointerEvent) => {
      if (startX === null) return;
      if (Math.abs(e.clientX - startX) >= 40) { fire(); startX = null; }
    };
    const onUp    = () => { startX = null; };

    canvas.addEventListener('pointerdown',  onDown);
    canvas.addEventListener('pointermove',  onMove);
    canvas.addEventListener('pointerup',    onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown',  onDown);
      canvas.removeEventListener('pointermove',  onMove);
      canvas.removeEventListener('pointerup',    onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [stepKey, map, ready]);

  // ── 4: Open MiniMap ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'open_minimap') return;
    if (sheetOpen && !sheetWasOpenRef.current) {
      sheetWasOpenRef.current = true;
      fire();
    }
    if (!sheetOpen) sheetWasOpenRef.current = false;
  }, [stepKey, sheetOpen]);

  // ── 5: Select point ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'select_point') return;
    return subscribeSelectedPointCoords(() => {
      const has = getSelectedPointCoordsSnapshot().coords != null;
      if (has && !hadSelectedPointRef.current) fire();
      if (!has) hadSelectedPointRef.current = false;
    });
  }, [stepKey]);

  // ── 6: Tap HUD ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'tap_hud') return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-hud]')) fire();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [stepKey]);

  // ── 6: Unlock territories ─────────────────────────────────────────────────
  // DemoTerritoryUnlockChip owns this step — calls syncCurrentTerritoryStack
  // inline and fires onInteraction directly after claim. No bridge listener.

  // ── 7: Collect heart ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'collect_heart') {
      if (stepKey !== 'collect_coin') {
        clearDemoWorldPlacements();
        resetDemoCollectProgress();
      }
      return;
    }

    let seeded = false;
    let gpsTimer: ReturnType<typeof setTimeout> | null = null;

    const trySeed = () => {
      if (seeded) return;
      const fix = resolveDemoSeedCoords();
      if (!fix) return;
      clearDemoWorldPlacements();
      resetDemoCollectProgress();
      seedDemoHeartNear(fix);
      seeded = true;
      if (gpsTimer) { clearTimeout(gpsTimer); gpsTimer = null; }
    };

    trySeed();
    let unsubCoords: () => void;
    if (!seeded) {
      unsubCoords = subscribeFindMeCoords(trySeed);
      // If GPS never arrives, auto-advance after 20s so the user isn't stuck.
      gpsTimer = setTimeout(() => { if (!seeded) fire(); }, 20_000);
    } else {
      unsubCoords = () => {};
    }

    if (getDemoCollectProgress().heartCollected) fire();
    const unsubProg = subscribeDemoCollectProgress(() => {
      if (getDemoCollectProgress().heartCollected) fire();
    });

    return () => {
      unsubCoords();
      unsubProg();
      if (gpsTimer) clearTimeout(gpsTimer);
    };
  }, [stepKey]);

  // ── 8: Collect coin ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stepKey !== 'collect_coin') return;

    let seeded = false;
    let gpsTimer: ReturnType<typeof setTimeout> | null = null;

    const trySeed = () => {
      if (seeded) return;
      const fix = resolveDemoSeedCoords();
      if (!fix) return;
      seedDemoCoinNear(fix);
      seeded = true;
      if (gpsTimer) { clearTimeout(gpsTimer); gpsTimer = null; }
    };

    trySeed();
    let unsubCoords: () => void;
    if (!seeded) {
      unsubCoords = subscribeFindMeCoords(trySeed);
      gpsTimer = setTimeout(() => { if (!seeded) fire(); }, 20_000);
    } else {
      unsubCoords = () => {};
    }

    if (getDemoCollectProgress().coinCollected) fire();
    const unsubProg = subscribeDemoCollectProgress(() => {
      if (getDemoCollectProgress().coinCollected) fire();
    });

    return () => {
      unsubCoords();
      unsubProg();
      if (gpsTimer) clearTimeout(gpsTimer);
      clearDemoWorldPlacements();
      resetDemoCollectProgress();
    };
  }, [stepKey]);

  return null;
}
