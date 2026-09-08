/**
 * Resolve jurisdictions at a point + post passport presence.
 * Used by splash boot and the continuous AppShell controller.
 */

import {
  isPrimaryTerritoryKind,
  isSaveableTerritoryDockKind,
} from '@/features/accountTerritories/store/constants';
import {
  getCurrentTerritoryStackSnapshot,
  setCurrentTerritoryStackLoading,
  setCurrentTerritoryStackResult,
  stackKeyFromJurisdictions,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { enqueueTerritoryUnlocks } from '@/features/accountTerritories/store/territoryUnlockStore';
import { refreshPendingXp } from '@/features/xp/store/pendingXpStore';
import { fetchTerritoryAtPoint } from '@/lib/territory/fetchTerritoryAtPoint';
import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';

export type NewlyUnlockedTerritory = { unitKind: string; unitId: string; name: string; xpAmount: number };

export type SyncCurrentTerritoryStackResult = {
  jurisdictions: TerritoryAtPointItem[];
  stackKey: string;
  newlyUnlocked: NewlyUnlockedTerritory[];
  changed: boolean;
};

/** ~110 m — GPS jitter shouldn't refetch; real moves do. */
export function territoryStackGridKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/** ~1.1 km — presence write volume while driving. */
export function territoryPresenceGridKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function postPresence(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<NewlyUnlockedTerritory[]> {
  const res = await fetch('/api/account-territories/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
    signal,
    credentials: 'include',
  });
  // Soft no-op on reject (incl. location_implausible velocity gate) — stack
  // still refreshes from at-point; unlock XP simply does not grant this tick.
  if (!res.ok) return [];
  const body = (await res.json()) as { newlyUnlocked?: NewlyUnlockedTerritory[] };
  const newlyUnlocked = body.newlyUnlocked ?? [];
  if (!newlyUnlocked.length) return [];

  // Unlock XP lands unclaimed — refresh the global pending-XP rollup and
  // queue the contextual claim modal for primary kinds only (county, ctu,
  // school_district). Legislative / congressional XP is silently granted;
  // zip stays in the ledger but never surfaces.
  void refreshPendingXp();
  enqueueTerritoryUnlocks(
    newlyUnlocked.filter((t) => isPrimaryTerritoryKind(t.unitKind)),
  );
  return newlyUnlocked;
}

/**
 * Fetch at-point stack and (when signed in) post presence for this fix.
 * Updates currentTerritoryStackStore. Returns whether the stack identity changed.
 */
export async function syncCurrentTerritoryStack(
  lat: number,
  lng: number,
  options: {
    signal?: AbortSignal;
    /** When false, skip passport POST (anon / no account). Default true. */
    postPresence?: boolean;
  } = {},
): Promise<SyncCurrentTerritoryStackResult> {
  const post = options.postPresence !== false;
  setCurrentTerritoryStackLoading(true);

  try {
    const [atPoint, newlyUnlocked] = await Promise.all([
      fetchTerritoryAtPoint(lat, lng, options.signal),
      post ? postPresence(lat, lng, options.signal) : Promise.resolve([] as NewlyUnlockedTerritory[]),
    ]);

    if (options.signal?.aborted) {
      return {
        jurisdictions: getCurrentTerritoryStackSnapshot().jurisdictions,
        stackKey: getCurrentTerritoryStackSnapshot().stackKey ?? '',
        newlyUnlocked: [],
        changed: false,
      };
    }

    const jurisdictions = (atPoint?.jurisdictions ?? []).filter((j) =>
      isSaveableTerritoryDockKind(j.kind),
    );
    const prevKey = getCurrentTerritoryStackSnapshot().stackKey;
    const stackKey = stackKeyFromJurisdictions(jurisdictions);
    const changed = stackKey !== prevKey;

    setCurrentTerritoryStackResult({
      coords: { lat, lng },
      jurisdictions,
      error:
        jurisdictions.length === 0
          ? 'No territories resolved at this location.'
          : null,
    });

    return { jurisdictions, stackKey, newlyUnlocked, changed };
  } catch {
    if (options.signal?.aborted) {
      return {
        jurisdictions: [],
        stackKey: '',
        newlyUnlocked: [],
        changed: false,
      };
    }
    setCurrentTerritoryStackResult({
      coords: { lat, lng },
      jurisdictions: getCurrentTerritoryStackSnapshot().jurisdictions,
      error: 'Could not refresh territories for this location.',
    });
    return {
      jurisdictions: getCurrentTerritoryStackSnapshot().jurisdictions,
      stackKey: getCurrentTerritoryStackSnapshot().stackKey ?? '',
      newlyUnlocked: [],
      changed: false,
    };
  }
}
