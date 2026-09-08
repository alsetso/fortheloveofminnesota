'use client';

import { useEffect } from 'react';
import { useLiveLocationTerritories } from '@/features/accountTerritories/store/useLiveLocationTerritories';
import { pointTerritoryColorAt } from '@/features/map/territory/pointTerritoryColors';
import {
  clearPointTerritoryOverlays,
  isPointTerritoryKind,
  syncPointTerritoryOverlays,
  type PointTerritoryKey,
} from '@/features/map/territory/pointTerritoryOverlays';
import {
  setTerritoriesAroundMeResult,
  useTerritoriesAroundMe,
} from '@/features/map/territory/territoriesAroundMeStore';
import { useEnforceAroundMeExclusive } from '@/features/map/territory/useAroundMeExclusive';

/**
 * Territories around me — persistent layer service (mounted once in the shell).
 * While on: resolves the jurisdictions at the live Find Me position, paints
 * only those onto the map, and keeps painting after any dock card closes.
 * Exclusivity with Explore's boundary layers is owned entirely by
 * `useAroundMeExclusive` — this controller just enforces it.
 */
export function TerritoriesAroundMeController() {
  const { on } = useTerritoriesAroundMe();
  const live = useLiveLocationTerritories(on);
  useEnforceAroundMeExclusive();

  useEffect(() => {
    setTerritoriesAroundMeResult({
      coords: live.coords,
      jurisdictions: live.jurisdictions,
      loading: live.loading,
      error: live.error,
    });
  }, [live]);

  useEffect(() => {
    if (!on) {
      clearPointTerritoryOverlays();
      return;
    }
    const ac = new AbortController();
    const items: PointTerritoryKey[] = [];
    for (const j of live.jurisdictions) {
      if (!isPointTerritoryKind(j.kind)) continue;
      items.push({ kind: j.kind, id: j.id, color: pointTerritoryColorAt(items.length) });
    }
    void syncPointTerritoryOverlays(items, { signal: ac.signal });
    return () => {
      ac.abort();
    };
  }, [on, live.jurisdictions]);

  return null;
}
