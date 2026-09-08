/**
 * In-app vs all-day step split.
 *
 * HealthKit cannot filter by source via Despia, so we attribute steps taken
 * while Own is in the foreground by deltaing today's Health total across
 * visibility sessions. Outside = allDay − inApp (clamped).
 */

export const HEALTH_STEPS_SESSION_KEY = 'ftlomn_health_steps_session_v1';

export type HealthStepsSessionLedger = {
  /** Local calendar day YYYY-MM-DD */
  day: string;
  /** Steps attributed to closed foreground sessions today */
  inApp: number;
  /** Open foreground session, if any */
  open: null | { baseline: number; at: number };
};

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyLedger(day = todayKey()): HealthStepsSessionLedger {
  return { day, inApp: 0, open: null };
}

export function readStepsSessionLedger(): HealthStepsSessionLedger {
  if (typeof window === 'undefined') return emptyLedger();
  try {
    const raw = localStorage.getItem(HEALTH_STEPS_SESSION_KEY);
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw) as Partial<HealthStepsSessionLedger>;
    const day = typeof parsed.day === 'string' ? parsed.day : todayKey();
    const inApp =
      typeof parsed.inApp === 'number' && Number.isFinite(parsed.inApp)
        ? Math.max(0, Math.floor(parsed.inApp))
        : 0;
    const open =
      parsed.open &&
      typeof parsed.open.baseline === 'number' &&
      typeof parsed.open.at === 'number'
        ? {
            baseline: Math.max(0, Math.floor(parsed.open.baseline)),
            at: parsed.open.at,
          }
        : null;
    const ledger: HealthStepsSessionLedger = { day, inApp, open };
    if (ledger.day !== todayKey()) return emptyLedger();
    return ledger;
  } catch {
    return emptyLedger();
  }
}

export function writeStepsSessionLedger(ledger: HealthStepsSessionLedger): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HEALTH_STEPS_SESSION_KEY, JSON.stringify(ledger));
  } catch {
    /* ignore */
  }
}

export function clearStepsSessionLedger(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(HEALTH_STEPS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** In-app total including the live open session delta. */
export function inAppStepsFromLedger(
  ledger: HealthStepsSessionLedger,
  allDay: number | null,
): number {
  if (allDay == null || allDay < 0) {
    return Math.max(0, ledger.inApp);
  }
  let inApp = ledger.inApp;
  if (ledger.open) {
    inApp += Math.max(0, allDay - ledger.open.baseline);
  }
  return Math.min(allDay, Math.max(0, Math.floor(inApp)));
}

export function outsideSteps(allDay: number | null, inApp: number): number | null {
  if (allDay == null) return null;
  return Math.max(0, allDay - inApp);
}

/**
 * Foreground: open a session baseline if needed.
 * Returns the updated ledger.
 */
export function beginStepsSession(
  allDay: number,
  prev = readStepsSessionLedger(),
): HealthStepsSessionLedger {
  const day = todayKey();
  const base = prev.day === day ? prev : emptyLedger(day);
  if (base.open) {
    writeStepsSessionLedger(base);
    return base;
  }
  const next: HealthStepsSessionLedger = {
    day,
    inApp: base.inApp,
    open: { baseline: Math.max(0, Math.floor(allDay)), at: Date.now() },
  };
  writeStepsSessionLedger(next);
  return next;
}

/**
 * Flush open-session delta into `inApp`.
 * `keepOpen` — stay in foreground (interval tick); else close session (background).
 */
export function flushStepsSession(
  allDay: number,
  keepOpen: boolean,
  prev = readStepsSessionLedger(),
): HealthStepsSessionLedger {
  const day = todayKey();
  const base = prev.day === day ? prev : emptyLedger(day);
  if (!base.open) {
    const next = keepOpen
      ? beginStepsSession(allDay, base)
      : base;
    writeStepsSessionLedger(next);
    return next;
  }

  const delta = Math.max(0, Math.floor(allDay) - base.open.baseline);
  const inApp = base.inApp + delta;
  const next: HealthStepsSessionLedger = keepOpen
    ? {
        day,
        inApp,
        open: { baseline: Math.max(0, Math.floor(allDay)), at: Date.now() },
      }
    : { day, inApp, open: null };

  writeStepsSessionLedger(next);
  return next;
}

/** Seed a demo in-app total for browser preview (first share of the day). */
export function seedMockInAppIfEmpty(allDay: number): HealthStepsSessionLedger {
  const ledger = readStepsSessionLedger();
  if (ledger.inApp > 0 || ledger.open) return ledger;
  const hour = new Date().getHours();
  const fraction = Math.min(0.45, 0.12 + hour * 0.015);
  const seeded = Math.floor(allDay * fraction);
  const next: HealthStepsSessionLedger = {
    day: todayKey(),
    inApp: seeded,
    open: { baseline: Math.max(0, Math.floor(allDay)), at: Date.now() },
  };
  writeStepsSessionLedger(next);
  return next;
}
