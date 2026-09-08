'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { despiaCall, isDespia } from '@/lib/despia/despia';

export type DeviceHeadingPermission =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export type UseDeviceHeadingOptions = {
  /** EMA blend toward new sample (0–1). Default 0.45. */
  smoothing?: number;
  /** Ignore updates smaller than this (degrees). Default 0.5. */
  minDeltaDegrees?: number;
  /**
   * Absolute turn larger than this (degrees) blends much harder so phone
   * spins don't lag behind. Default 25.
   */
  snapDeltaDegrees?: number;
  /** Blend factor used when |delta| ≥ snapDeltaDegrees. Default 0.85. */
  snapSmoothing?: number;
};

export type UseDeviceHeadingReturn = {
  heading: number | null;
  permissionState: DeviceHeadingPermission;
  running: boolean;
  /** iOS Safari needs a user gesture; Despia gyro needs none. */
  requestPermission: () => Promise<boolean>;
  start: () => void;
  stop: () => void;
};

type DespiaGyroReading = {
  status?: string;
  heading?: number;
  headingAccuracy?: number;
  error?: string;
};

type DeviceOrientationConstructor = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

declare global {
  interface Window {
    onGyroscopeChange?: ((data: DespiaGyroReading) => void) | null;
  }
}

function normalizeDegrees(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** Shortest signed delta from `from` → `to` in (−180, 180]. */
function shortestDelta(from: number, to: number): number {
  let d = normalizeDegrees(to) - normalizeDegrees(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function headingFromDeviceOrientation(event: DeviceOrientationEvent): number | null {
  const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof webkit === 'number' && Number.isFinite(webkit)) {
    return normalizeDegrees(webkit);
  }
  if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    // Common web fallback: alpha is degrees from north, counterclockwise.
    return normalizeDegrees(360 - event.alpha);
  }
  return null;
}

/**
 * Smoothed device heading (0–360, north = 0, clockwise — Mapbox bearing).
 * Despia: gyroscope:// + onGyroscopeChange (magnetic heading, no permission).
 * Web: DeviceOrientation / webkitCompassHeading.
 */
export function useDeviceHeading(
  options: UseDeviceHeadingOptions = {},
): UseDeviceHeadingReturn {
  const smoothing = options.smoothing ?? 0.45;
  const minDelta = options.minDeltaDegrees ?? 0.5;
  const snapDelta = options.snapDeltaDegrees ?? 25;
  const snapSmoothing = options.snapSmoothing ?? 0.85;

  const [heading, setHeading] = useState<number | null>(null);
  const [permissionState, setPermissionState] =
    useState<DeviceHeadingPermission>('unknown');
  const [running, setRunning] = useState(false);

  const runningRef = useRef(false);
  const smoothedRef = useRef<number | null>(null);
  const smoothingRef = useRef(smoothing);
  const minDeltaRef = useRef(minDelta);
  const snapDeltaRef = useRef(snapDelta);
  const snapSmoothingRef = useRef(snapSmoothing);
  smoothingRef.current = smoothing;
  minDeltaRef.current = minDelta;
  snapDeltaRef.current = snapDelta;
  snapSmoothingRef.current = snapSmoothing;

  const applySample = useCallback((raw: number) => {
    if (!Number.isFinite(raw) || raw < 0) return;
    const next = normalizeDegrees(raw);
    const prev = smoothedRef.current;
    if (prev == null) {
      smoothedRef.current = next;
      setHeading(next);
      return;
    }
    const delta = shortestDelta(prev, next);
    if (Math.abs(delta) < minDeltaRef.current) return;
    const alpha =
      Math.abs(delta) >= snapDeltaRef.current
        ? snapSmoothingRef.current
        : smoothingRef.current;
    const blended = normalizeDegrees(prev + delta * alpha);
    smoothedRef.current = blended;
    setHeading(blended);
  }, []);

  const onWebOrientation = useCallback(
    (event: Event) => {
      if (!runningRef.current) return;
      const h = headingFromDeviceOrientation(event as DeviceOrientationEvent);
      if (h != null) applySample(h);
    },
    [applySample],
  );

  const stopWeb = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('deviceorientation', onWebOrientation, true);
    window.removeEventListener('deviceorientationabsolute', onWebOrientation, true);
  }, [onWebOrientation]);

  const startWeb = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('deviceorientationabsolute', onWebOrientation, true);
    window.addEventListener('deviceorientation', onWebOrientation, true);
  }, [onWebOrientation]);

  const stopDespia = useCallback(() => {
    if (typeof window !== 'undefined' && window.onGyroscopeChange) {
      window.onGyroscopeChange = null;
    }
    void despiaCall('gyroscope://stop', ['gyroscopeActive']);
  }, []);

  const startDespia = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.onGyroscopeChange = (data: DespiaGyroReading) => {
      if (!runningRef.current) return;
      if (data.status === 'error') return;
      // calibration_required still streams heading — use when valid.
      if (typeof data.heading === 'number' && data.heading >= 0) {
        applySample(data.heading);
      }
    };
    void despiaCall('gyroscope://start?threshold=0', ['gyroscopeActive']);
  }, [applySample]);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);
    if (isDespia()) stopDespia();
    else stopWeb();
  }, [stopDespia, stopWeb]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    if (isDespia()) startDespia();
    else startWeb();
  }, [startDespia, startWeb]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isDespia()) {
      setPermissionState('granted');
      return true;
    }

    if (typeof window === 'undefined') {
      setPermissionState('unsupported');
      return false;
    }

    const DOE = DeviceOrientationEvent as unknown as DeviceOrientationConstructor;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        const granted = result === 'granted';
        setPermissionState(granted ? 'granted' : 'denied');
        return granted;
      } catch {
        setPermissionState('denied');
        return false;
      }
    }

    setPermissionState('granted');
    return true;
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    heading,
    permissionState,
    running,
    requestPermission,
    start,
    stop,
  };
}
