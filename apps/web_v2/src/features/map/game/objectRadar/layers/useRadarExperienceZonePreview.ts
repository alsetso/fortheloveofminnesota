'use client';

/**
 * Paints active primary experience zones on the shared Object Radar map.
 * Object Map lightbox gets name labels; MiniMap peek keeps polygons only.
 * Cleared while Explore Zone is on — venue layers own that surface.
 */

import { useEffect } from 'react';
import {
  clearPreviewZonesOnRadar,
  syncPreviewZonesOnRadar,
} from '@/features/map/game/objectRadar/layers/zonePolygonOnRadar';
import { getObjectRadarMap } from '@/features/map/game/objectRadar/services/objectRadarMapEngine';
import { fetchExperienceZonesList } from '@/lib/experienceZones/fetchExperienceZonesList';
import type { ExperienceZoneListItem } from '@/lib/experienceZones/experienceZoneTypes';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedZones: ExperienceZoneListItem[] | null = null;
let cacheSetAt = 0;
let inflight: Promise<ExperienceZoneListItem[]> | null = null;

async function loadPreviewZones(): Promise<ExperienceZoneListItem[]> {
  const age = Date.now() - cacheSetAt;
  if (cachedZones && age < CACHE_TTL_MS) return cachedZones;
  if (inflight) return inflight;

  inflight = fetchExperienceZonesList()
    .then((result) => {
      const zones = result?.zones ?? [];
      if (result) { cachedZones = zones; cacheSetAt = Date.now(); }
      return zones;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useRadarExperienceZonePreview(opts: {
  mapReady: boolean;
  exploring: boolean;
  sheetOpen: boolean;
}): void {
  const { mapReady, exploring, sheetOpen } = opts;

  useEffect(() => {
    if (!mapReady) return;
    const map = getObjectRadarMap();
    if (!map) return;

    if (exploring) {
      clearPreviewZonesOnRadar(map);
      return;
    }

    const ac = new AbortController();
    void (async () => {
      try {
        const zones = await loadPreviewZones();
        if (ac.signal.aborted) return;
        const live = getObjectRadarMap();
        if (!live) return;
        await syncPreviewZonesOnRadar(live, zones, {
          labels: sheetOpen,
          signal: ac.signal,
        });
      } catch {
        /* aborted / network */
      }
    })();

    return () => {
      ac.abort();
    };
  }, [mapReady, exploring, sheetOpen]);
}
