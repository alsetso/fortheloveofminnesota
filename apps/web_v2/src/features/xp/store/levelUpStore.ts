/**
 * Level-up ceremony pipeline for claim / collect:
 *   1. Action succeeds with XP
 *   2. prepareLevelUpFromGrant() — if the grant crosses level(s), HOLD
 *      one ceremony per level step (1→2, then 2→3, …)
 *   3. XpReceipt (Claimed! / Collected!) shows first
 *   4. On Continue → releaseLevelUpSequence() plays held ceremonies
 *   5. Each ceremony requires Confirm before the next dequeues
 *
 * Snapshots always return a new array reference — required for
 * useSyncExternalStore to re-render LevelUpSequence.
 */

import { levelFromXp, xpThresholdForLevel } from '@/features/xp/logic/xpCurve';

export type LevelUpEvent = {
  from: number;
  to: number;
  /** Total claimed XP after this step settles. */
  totalXp: number;
  /** Total claimed XP at the start of this step's fill. */
  previousTotalXp: number;
  xpGained: number;
  xpCeiling: number;
  /** Published curve steepness at grant time (1 = linear). */
  xpCurveExponent: number;
  source: 'claim' | 'collect' | 'other';
};

type Listener = () => void;

let knownLevel: number | null = null;
let knownTotalXp: number | null = null;
let knownCeiling: number | null = null;
let knownExponent: number = 1;

/** Prepared but not yet shown — waiting for claim/collect success dismiss. */
let held: LevelUpEvent[] = [];
/** Ready for LevelUpSequence to play (queue[0] is active). */
let ready: LevelUpEvent[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeLevelUpQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Only released (playable) events — LevelUpSequence ignores held ones. */
export function getLevelUpQueueSnapshot(): LevelUpEvent[] {
  return ready;
}

export function getHeldLevelUpSnapshot(): LevelUpEvent[] {
  return held;
}

export function getKnownLevelSnapshot(): number | null {
  return knownLevel;
}

export function getKnownTotalXpSnapshot(): number | null {
  return knownTotalXp;
}

export function getKnownCeilingSnapshot(): number | null {
  return knownCeiling;
}

export function getKnownExponentSnapshot(): number {
  return knownExponent;
}

/** Seeds baselines from any level fetch so the first climb of a session
 * registers as a climb instead of silently becoming the baseline. */
export function primeLevelState(opts: {
  level?: number | null;
  totalXp?: number | null;
  xpCeiling?: number | null;
  xpCurveExponent?: number | null;
}): void {
  if (typeof opts.level === 'number' && Number.isFinite(opts.level) && knownLevel === null) {
    knownLevel = opts.level;
  }
  if (
    typeof opts.totalXp === 'number' &&
    Number.isFinite(opts.totalXp) &&
    knownTotalXp === null
  ) {
    knownTotalXp = opts.totalXp;
  }
  if (
    typeof opts.xpCeiling === 'number' &&
    Number.isFinite(opts.xpCeiling) &&
    opts.xpCeiling > 0
  ) {
    knownCeiling = opts.xpCeiling;
  }
  if (
    typeof opts.xpCurveExponent === 'number' &&
    Number.isFinite(opts.xpCurveExponent) &&
    opts.xpCurveExponent > 0
  ) {
    knownExponent = opts.xpCurveExponent;
  }
}

/** @deprecated Prefer primeLevelState. */
export function primeLevel(currentLevel: number | null | undefined): void {
  primeLevelState({ level: currentLevel });
}

/**
 * Preflight: would claiming/collecting this much XP cross the next level
 * given the account's known standing? Used to arm UI copy before the RPC.
 */
export function wouldXpCrossLevel(xpGained: number): {
  crosses: boolean;
  from: number;
  to: number;
  previousTotalXp: number;
  projectedTotalXp: number;
} | null {
  if (
    typeof xpGained !== 'number' ||
    !Number.isFinite(xpGained) ||
    xpGained <= 0 ||
    knownTotalXp == null ||
    knownLevel == null
  ) {
    return null;
  }
  const ceiling = knownCeiling ?? 10_000;
  const previousTotalXp = knownTotalXp;
  const projectedTotalXp = previousTotalXp + xpGained;
  const from = knownLevel;
  const to = levelFromXp(projectedTotalXp, ceiling, knownExponent);
  return {
    crosses: to > from,
    from,
    to,
    previousTotalXp,
    projectedTotalXp,
  };
}

export type PrepareLevelUpResult = {
  /** True when a level-up sequence was held for release after success UI. */
  prepared: boolean;
  from: number | null;
  to: number | null;
};

/**
 * Build one ceremony per crossed level (1→2, 2→3, …) so a multi-level
 * grant plays as a confirmable sequence, not a single jump label.
 */
function buildLevelStepEvents(opts: {
  fromLevel: number;
  toLevel: number;
  previousTotalXp: number;
  finalTotalXp: number;
  xpGained: number;
  ceiling: number;
  exponent: number;
  source: LevelUpEvent['source'];
}): LevelUpEvent[] {
  const events: LevelUpEvent[] = [];
  for (let level = opts.fromLevel; level < opts.toLevel; level += 1) {
    const stepFrom = level;
    const stepTo = level + 1;
    const stepPreviousXp =
      stepFrom === opts.fromLevel
        ? opts.previousTotalXp
        : xpThresholdForLevel(stepFrom, opts.ceiling, opts.exponent);
    // Intermediate steps settle at the top of the new band (blasting through);
    // the final step settles at the real post-grant total.
    const stepTotalXp =
      stepTo < opts.toLevel
        ? xpThresholdForLevel(stepTo + 1, opts.ceiling, opts.exponent)
        : opts.finalTotalXp;
    events.push({
      from: stepFrom,
      to: stepTo,
      totalXp: stepTotalXp,
      previousTotalXp: stepPreviousXp,
      xpGained: opts.xpGained,
      xpCeiling: opts.ceiling,
      xpCurveExponent: opts.exponent,
      source: opts.source,
    });
  }
  return events;
}

/**
 * After a successful claim/collect — if the grant pushed the account over a
 * level boundary, HOLD one ceremony per level step. Returns whether any were armed.
 * Always updates known standing baselines.
 */
export function prepareLevelUpFromGrant(opts: {
  level: number | null | undefined;
  totalXp: number | null | undefined;
  xpGained?: number | null;
  xpCeiling?: number | null;
  xpCurveExponent?: number | null;
  source?: LevelUpEvent['source'];
}): PrepareLevelUpResult {
  const nextLevel = opts.level;
  const nextTotal =
    typeof opts.totalXp === 'number' && Number.isFinite(opts.totalXp) ? opts.totalXp : null;
  const gained =
    typeof opts.xpGained === 'number' && Number.isFinite(opts.xpGained) ? opts.xpGained : 0;
  const source = opts.source ?? 'other';

  if (typeof opts.xpCeiling === 'number' && opts.xpCeiling > 0) {
    knownCeiling = opts.xpCeiling;
  }
  if (typeof opts.xpCurveExponent === 'number' && opts.xpCurveExponent > 0) {
    knownExponent = opts.xpCurveExponent;
  }

  if (typeof nextLevel !== 'number' || !Number.isFinite(nextLevel)) {
    if (nextTotal != null) knownTotalXp = nextTotal;
    return { prepared: false, from: null, to: null };
  }

  if (knownLevel === null) {
    knownLevel = nextLevel;
    if (nextTotal != null) knownTotalXp = nextTotal;
    return { prepared: false, from: null, to: null };
  }

  if (nextLevel > knownLevel) {
    const ceiling = knownCeiling ?? 10_000;
    const fromLevel = knownLevel;
    const previousTotalXp =
      knownTotalXp != null
        ? knownTotalXp
        : nextTotal != null
          ? Math.max(xpThresholdForLevel(fromLevel, ceiling, knownExponent), nextTotal - gained)
          : xpThresholdForLevel(fromLevel, ceiling, knownExponent);
    const finalTotalXp = nextTotal ?? previousTotalXp + gained;
    const steps = buildLevelStepEvents({
      fromLevel,
      toLevel: nextLevel,
      previousTotalXp,
      finalTotalXp,
      xpGained: gained,
      ceiling,
      exponent: knownExponent,
      source,
    });
    held = [...held, ...steps];
    knownLevel = nextLevel;
    if (nextTotal != null) knownTotalXp = nextTotal;
    // Don't emit ready — sequence waits for release after receipt dismiss.
    emit();
    return { prepared: true, from: fromLevel, to: nextLevel };
  }

  knownLevel = nextLevel;
  if (nextTotal != null) knownTotalXp = nextTotal;
  return { prepared: false, from: null, to: null };
}

/**
 * Release any held level-up ceremonies so LevelUpSequence can play them.
 * Call from Claimed! / Collected! dismiss (Continue).
 */
export function releaseLevelUpSequence(): void {
  if (held.length === 0) return;
  ready = [...ready, ...held];
  held = [];
  emit();
}

/** True while a grant prepared a level-up that hasn't been released yet. */
export function hasHeldLevelUp(): boolean {
  return held.length > 0;
}

/**
 * Immediate path (no preceding success modal). Prefer prepare + release from
 * claim/collect; this auto-releases for any stray callers.
 */
export function reportLevelProgress(opts: {
  level: number | null | undefined;
  totalXp: number | null | undefined;
  xpGained?: number | null;
  xpCeiling?: number | null;
  source?: LevelUpEvent['source'];
}): PrepareLevelUpResult {
  const result = prepareLevelUpFromGrant(opts);
  if (result.prepared) releaseLevelUpSequence();
  return result;
}

/** @deprecated Prefer prepareLevelUpFromGrant + releaseLevelUpSequence. */
export function reportLevel(nextLevel: number | null | undefined): void {
  reportLevelProgress({ level: nextLevel, totalXp: knownTotalXp });
}

/** Dismiss the current ceremony and advance the queue. */
export function dequeueLevelUp(): LevelUpEvent | null {
  if (ready.length === 0) return null;
  const [next, ...rest] = ready;
  ready = rest;
  emit();
  return next;
}
