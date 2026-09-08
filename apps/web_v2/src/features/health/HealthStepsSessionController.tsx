'use client';

/**
 * While Health steps are shared, attribute foreground deltas as in-app steps.
 * Mount once under AppShell.
 */

import { useEffect } from 'react';
import { loadSharedStepCount } from '@/lib/despia/healthKit';
import { isHealthStepsShared } from '@/lib/despia/healthStepsPreference';
import {
  beginStepsSession,
  flushStepsSession,
} from '@/lib/despia/healthStepsSession';

const TICK_MS = 45_000;

function todayFromSamples(
  samples: { date: string; value: number }[],
): number | null {
  if (samples.length === 0) return null;
  const last = samples[samples.length - 1];
  return typeof last?.value === 'number' ? last.value : null;
}

async function syncSession(mode: 'foreground' | 'background' | 'tick') {
  if (!isHealthStepsShared()) return;
  const samples = await loadSharedStepCount(1);
  const allDay = todayFromSamples(samples);
  if (allDay == null) return;

  if (mode === 'foreground') beginStepsSession(allDay);
  else if (mode === 'background') flushStepsSession(allDay, false);
  else flushStepsSession(allDay, true);

  window.dispatchEvent(new CustomEvent('ftlomn:health-steps'));
}

/** Invisible controller — starts/stops in-app step attribution. */
export function HealthStepsSessionController() {
  useEffect(() => {
    const boot = () => {
      if (!isHealthStepsShared()) return;
      void syncSession(
        document.visibilityState === 'visible' ? 'foreground' : 'background',
      );
    };

    boot();

    const onVisibility = () => {
      if (!isHealthStepsShared()) return;
      void syncSession(
        document.visibilityState === 'visible' ? 'foreground' : 'background',
      );
    };

    // Fired by share / stop — not by sync ticks (avoids a loop).
    const onStatus = () => boot();

    const tick = window.setInterval(() => {
      if (!isHealthStepsShared()) return;
      if (document.visibilityState === 'visible') void syncSession('tick');
    }, TICK_MS);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('ftlomn:health-steps-status', onStatus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('ftlomn:health-steps-status', onStatus);
      window.clearInterval(tick);
      if (isHealthStepsShared()) void syncSession('background');
    };
  }, []);

  return null;
}
