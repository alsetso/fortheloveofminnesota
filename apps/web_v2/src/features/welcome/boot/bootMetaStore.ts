/**
 * bootMetaStore — Observable signal for fire-and-forget boot tasks.
 *
 * AuthBootstrap drives these values as side-effects complete.
 * SplashBootDebug and SetupGate subscribe to surface status / gate routing.
 *
 * Uses the same useSyncExternalStore pattern as currentTerritoryStackStore
 * so subscribers re-render automatically when any signal changes.
 */

export type BootMetaSnapshot = {
  /** True once warmAppShell has fully resolved during the warm_map phase. */
  warmShellDone: boolean;
  /** True once logWorldSession('boot') has been called for this session. */
  sessionLogged: boolean;
  /**
   * True once AuthBootstrap has completed the boot sequence and dismissed the
   * splash. SetupGate reads this to defer all routing to AuthBootstrap during
   * the splash phase (preventing competing redirects).
   */
  bootDone: boolean;
};

const INITIAL: BootMetaSnapshot = {
  warmShellDone: false,
  sessionLogged: false,
  bootDone: false,
};

let snapshot: BootMetaSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getBootMetaSnapshot(): BootMetaSnapshot {
  return snapshot;
}

export function subscribeBootMeta(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWarmShellDone(): void {
  if (snapshot.warmShellDone) return;
  snapshot = { ...snapshot, warmShellDone: true };
  emit();
}

export function setSessionLogged(): void {
  if (snapshot.sessionLogged) return;
  snapshot = { ...snapshot, sessionLogged: true };
  emit();
}

export function setBootDone(): void {
  if (snapshot.bootDone) return;
  snapshot = { ...snapshot, bootDone: true };
  emit();
}

export function resetBootMeta(): void {
  snapshot = INITIAL;
  emit();
}
