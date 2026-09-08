'use client';

import { useEffect, useMemo, useState } from 'react';

export type SavedTerritoryMatch = {
  saved: boolean;
  kinds: string[];
  isHome: boolean;
  homeLocked: boolean;
  homeResetAvailableAt: string | null;
};

/**
 * Batch territory unit id → saved / home state (avoid re-saving).
 */
export function useSavedTerritoryMatches(unitIds: string[]) {
  const idList = useMemo(
    () => [...new Set(unitIds.map((id) => id.trim()).filter(Boolean))].sort(),
    [unitIds],
  );
  const sig = idList.join('\0');

  const [matches, setMatches] = useState<Record<string, SavedTerritoryMatch>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (idList.length === 0) {
      setMatches({});
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/account-territories/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: ac.signal,
          body: JSON.stringify({ unitIds: idList }),
        });
        const json = (await res.json()) as {
          matches?: Record<string, SavedTerritoryMatch>;
        };
        if (!ac.signal.aborted && res.ok) {
          setMatches(normalizeMatches(json.matches ?? {}));
        }
      } catch {
        if (!ac.signal.aborted) setMatches({});
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const refresh = () => {
    if (idList.length === 0) return;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/account-territories/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ unitIds: idList }),
        });
        const json = (await res.json()) as {
          matches?: Record<string, SavedTerritoryMatch>;
        };
        if (res.ok) setMatches(normalizeMatches(json.matches ?? {}));
      } catch {
        /* keep prior matches */
      } finally {
        setLoading(false);
      }
    })();
  };

  return { matches, loading, refresh };
}

function normalizeMatches(
  raw: Record<string, Partial<SavedTerritoryMatch>>,
): Record<string, SavedTerritoryMatch> {
  const out: Record<string, SavedTerritoryMatch> = {};
  for (const [id, row] of Object.entries(raw)) {
    out[id] = {
      saved: Boolean(row.saved),
      kinds: Array.isArray(row.kinds) ? row.kinds.filter((k): k is string => typeof k === 'string') : [],
      isHome: Boolean(row.isHome),
      homeLocked: Boolean(row.homeLocked),
      homeResetAvailableAt:
        typeof row.homeResetAvailableAt === 'string' ? row.homeResetAvailableAt : null,
    };
  }
  return out;
}
