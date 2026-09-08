'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadSharedStepCount,
  requestStepSharing,
  stopStepSharing,
  type HealthKitDaySample,
} from '@/lib/despia/healthKit';
import {
  getHealthStepsStatus,
  setHealthStepsStatus,
  type HealthStepsStatus,
} from '@/lib/despia/healthStepsPreference';
import {
  beginStepsSession,
  inAppStepsFromLedger,
  outsideSteps,
  readStepsSessionLedger,
} from '@/lib/despia/healthStepsSession';
import { isDespiaIOS } from '@/lib/despia/despia';
import { haptic } from '@/lib/despia/haptics';

const WEEK_DAYS = 7;
const GOAL = 10_000;

export type UseHealthSteps = {
  status: HealthStepsStatus;
  samples: HealthKitDaySample[];
  /** All-day Health total (today). */
  allDay: number | null;
  /** Steps attributed while Own was open today. */
  inApp: number;
  /** allDay − inApp. */
  outside: number | null;
  goal: number;
  loading: boolean;
  requesting: boolean;
  /** Shared and we have readable Health/mock data. */
  showSteps: boolean;
  isNativeIos: boolean;
  share: () => Promise<void>;
  refresh: () => Promise<void>;
  stop: () => void;
};

function todayFromSamples(samples: HealthKitDaySample[]): number | null {
  if (samples.length === 0) return null;
  const last = samples[samples.length - 1];
  return typeof last?.value === 'number' ? last.value : null;
}

export function useHealthSteps(): UseHealthSteps {
  const [status, setStatus] = useState<HealthStepsStatus>('unset');
  const [samples, setSamples] = useState<HealthKitDaySample[]>([]);
  const [inApp, setInApp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [isNativeIos, setIsNativeIos] = useState(false);

  const applyBreakdown = useCallback((nextSamples: HealthKitDaySample[]) => {
    const allDay = todayFromSamples(nextSamples);
    const ledger = readStepsSessionLedger();
    setInApp(inAppStepsFromLedger(ledger, allDay));
  }, []);

  const refresh = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true;
    const current = getHealthStepsStatus();
    setStatus(current);
    setIsNativeIos(isDespiaIOS());

    if (current !== 'shared') {
      setSamples([]);
      setInApp(0);
      setLoading(false);
      return;
    }

    if (!soft) setLoading(true);
    try {
      const next = await loadSharedStepCount(WEEK_DAYS);
      if (next.length === 0 && isDespiaIOS()) {
        setHealthStepsStatus('denied');
        setStatus('denied');
        setSamples([]);
        setInApp(0);
      } else {
        setSamples(next);
        const dayTotal = todayFromSamples(next);
        if (dayTotal != null && document.visibilityState === 'visible') {
          beginStepsSession(dayTotal);
        }
        applyBreakdown(next);
      }
    } finally {
      if (!soft) setLoading(false);
    }
  }, [applyBreakdown]);

  useEffect(() => {
    void refresh();
    const onSync = () => void refresh({ soft: true });
    window.addEventListener('ftlomn:health-steps', onSync);
    return () => window.removeEventListener('ftlomn:health-steps', onSync);
  }, [refresh]);

  const share = useCallback(async () => {
    setRequesting(true);
    try {
      const result = await requestStepSharing(WEEK_DAYS);
      setStatus(result.status);
      setSamples(result.samples);
      if (result.status === 'shared') {
        const allDay = todayFromSamples(result.samples);
        if (allDay != null) beginStepsSession(allDay);
        applyBreakdown(result.samples);
        haptic.collect.success();
        window.dispatchEvent(new CustomEvent('ftlomn:health-steps-status'));
        window.dispatchEvent(new CustomEvent('ftlomn:health-steps'));
      } else {
        setInApp(0);
        haptic.collect.error();
      }
    } finally {
      setRequesting(false);
      setLoading(false);
    }
  }, [applyBreakdown]);

  const stop = useCallback(() => {
    stopStepSharing();
    setStatus('unset');
    setSamples([]);
    setInApp(0);
    window.dispatchEvent(new CustomEvent('ftlomn:health-steps-status'));
    window.dispatchEvent(new CustomEvent('ftlomn:health-steps'));
  }, []);

  const allDay = todayFromSamples(samples);
  const outside = outsideSteps(allDay, inApp);

  return {
    status,
    samples,
    allDay,
    inApp,
    outside,
    goal: GOAL,
    loading,
    requesting,
    showSteps: status === 'shared' && samples.length > 0,
    isNativeIos,
    share,
    refresh,
    stop,
  };
}
