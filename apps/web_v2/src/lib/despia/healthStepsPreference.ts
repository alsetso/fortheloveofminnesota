/**
 * Product opt-in for Apple Health steps UI.
 * OS Health permission is separate — this only records whether the user
 * chose to share (or declined / we got no access after the system prompt).
 */

export const HEALTH_STEPS_STATUS_KEY = 'ftlomn_health_steps_status';

export type HealthStepsStatus = 'unset' | 'shared' | 'denied';

function readRaw(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(HEALTH_STEPS_STATUS_KEY);
  } catch {
    return null;
  }
}

export function getHealthStepsStatus(): HealthStepsStatus {
  const raw = readRaw();
  if (raw === 'shared' || raw === 'denied') return raw;
  return 'unset';
}

export function setHealthStepsStatus(status: HealthStepsStatus): void {
  if (typeof window === 'undefined') return;
  try {
    if (status === 'unset') localStorage.removeItem(HEALTH_STEPS_STATUS_KEY);
    else localStorage.setItem(HEALTH_STEPS_STATUS_KEY, status);
  } catch {
    /* ignore quota / private mode */
  }
}

export function isHealthStepsShared(): boolean {
  return getHealthStepsStatus() === 'shared';
}
