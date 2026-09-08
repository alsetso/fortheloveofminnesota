/**
 * Apple HealthKit via Despia — steps-first read helpers.
 * @see https://setup.despia.com/health-data/apple-health.md
 *
 * Requires: HealthKit capability on the App Store bundle ID,
 * Despia Editor → App → Addons → Health Data, then a native rebuild (not OTA).
 */
import { despiaCall, isDespia, isDespiaIOS } from '@/lib/despia/despia';
import {
  getHealthStepsStatus,
  setHealthStepsStatus,
  type HealthStepsStatus,
} from '@/lib/despia/healthStepsPreference';
import {
  clearStepsSessionLedger,
  seedMockInAppIfEmpty,
} from '@/lib/despia/healthStepsSession';

export const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;

export type HealthKitDaySample = {
  date: string;
  value: number;
  unit: string;
};

type HealthKitResponseEnvelope = {
  healthkitResponse?:
    | Record<string, HealthKitDaySample[] | string | number | unknown>
    | HealthKitDaySample[];
};

function clampDays(days: number): number {
  if (!Number.isFinite(days) || days < 1) return 1;
  return Math.min(Math.floor(days), 365);
}

function asDaySamples(value: unknown): HealthKitDaySample[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is HealthKitDaySample => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return typeof r.date === 'string' && typeof r.value === 'number';
  });
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Deterministic browser/dev steps so the UI is testable outside Despia iOS. */
export function getMockStepCount(days = 7): HealthKitDaySample[] {
  const windowDays = clampDays(days);
  const out: HealthKitDaySample[] = [];
  const now = new Date();
  const today = dayKey(now);
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    let value = 4200 + (seed % 7800);
    // Today creeps up through the day so session deltas work in browser preview.
    if (key === today) {
      const minutes = now.getHours() * 60 + now.getMinutes();
      value = 2800 + (seed % 2400) + Math.floor(minutes * 3.2);
    }
    out.push({ date: key, value, unit: 'count' });
  }
  return out;
}

/**
 * Read daily step counts for the last `days` (default 7).
 * Prompts for Health permission on first use. Returns [] outside Despia iOS
 * or when HealthKit is unavailable / denied / not linked in the binary.
 */
export async function readStepCount(days = 7): Promise<HealthKitDaySample[]> {
  if (!isDespiaIOS()) return [];

  const windowDays = clampDays(days);
  const raw = (await despiaCall(
    `readhealthkit://${STEP_COUNT_TYPE}?days=${windowDays}`,
    ['healthkitResponse'],
  )) as HealthKitResponseEnvelope | null;

  const response = raw?.healthkitResponse;
  if (!response) return [];

  // Current API: keyed by identifier. Legacy: flat daily array.
  if (Array.isArray(response)) return asDaySamples(response);
  return asDaySamples(response[STEP_COUNT_TYPE]);
}

/** Today's step total, or null when unavailable. */
export async function readTodayStepCount(): Promise<number | null> {
  const samples = await readStepCount(1);
  if (samples.length === 0) return null;
  const last = samples[samples.length - 1];
  return typeof last?.value === 'number' ? last.value : null;
}

/**
 * Load steps for UI: real HealthKit on Despia iOS, mock elsewhere.
 * Only returns samples when the user has shared (`shared` preference).
 */
export async function loadSharedStepCount(days = 7): Promise<HealthKitDaySample[]> {
  if (getHealthStepsStatus() !== 'shared') return [];
  if (isDespiaIOS()) return readStepCount(days);
  return getMockStepCount(days);
}

export type RequestStepSharingResult = {
  status: HealthStepsStatus;
  samples: HealthKitDaySample[];
};

/**
 * Clear user-facing trigger for HealthKit steps access.
 * On Despia iOS this fires the system Health permission sheet on first call.
 * On web / non-iOS Despia it opts in with mock data so the UI can be built.
 */
export async function requestStepSharing(
  days = 7,
): Promise<RequestStepSharingResult> {
  // Browser / Android: opt in with mock — no HealthKit.
  if (!isDespiaIOS()) {
    if (isDespia()) {
      // Android Despia — HealthKit unavailable; don't pretend.
      setHealthStepsStatus('denied');
      return { status: 'denied', samples: [] };
    }
    setHealthStepsStatus('shared');
    const samples = getMockStepCount(days);
    const today = samples[samples.length - 1]?.value ?? 0;
    seedMockInAppIfEmpty(today);
    return { status: 'shared', samples };
  }

  const samples = await readStepCount(days);
  if (samples.length > 0) {
    setHealthStepsStatus('shared');
    return { status: 'shared', samples };
  }

  // Empty after the system prompt ≈ denied or Health has nothing we can read.
  setHealthStepsStatus('denied');
  return { status: 'denied', samples: [] };
}

/** Clear product opt-in (does not revoke iOS Health permission). */
export function stopStepSharing(): void {
  setHealthStepsStatus('unset');
  clearStepsSessionLedger();
}
