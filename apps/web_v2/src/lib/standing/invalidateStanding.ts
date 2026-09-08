/** Broadcast so level / passport / collections refetch after XP events (collect, unlock). */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeStandingInvalidation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after collect, territory unlock, or any XP grant the client knows about. */
export function invalidateStanding(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  }
}
