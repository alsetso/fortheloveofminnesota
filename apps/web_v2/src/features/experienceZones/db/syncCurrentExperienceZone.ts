/**
 * Resolve experience zones at a point. No passport/XP side effects.
 */

import {
  getCurrentExperienceZoneSnapshot,
  setCurrentExperienceZoneLoading,
  setCurrentExperienceZoneResult,
  zoneKeyFromZones,
} from '@/features/experienceZones/store/currentExperienceZoneStore';
import { fetchExperienceZoneAtPoint } from '@/lib/experienceZones/fetchExperienceZoneAtPoint';
import type { ExperienceZoneAtPointItem } from '@/lib/experienceZones/experienceZoneTypes';

export type SyncCurrentExperienceZoneResult = {
  zones: ExperienceZoneAtPointItem[];
  zoneKey: string;
  changed: boolean;
};

/** Same ~110 m grid as territory stack — GPS jitter shouldn't refetch. */
export function experienceZoneGridKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function syncCurrentExperienceZone(
  lat: number,
  lng: number,
  options: { signal?: AbortSignal } = {},
): Promise<SyncCurrentExperienceZoneResult> {
  const prev = getCurrentExperienceZoneSnapshot();
  setCurrentExperienceZoneLoading(true);

  try {
    const result = await fetchExperienceZoneAtPoint(lat, lng, options.signal);
    if (options.signal?.aborted) {
      setCurrentExperienceZoneLoading(false);
      return {
        zones: prev.zones,
        zoneKey: prev.zoneKey ?? '',
        changed: false,
      };
    }

    const zones = Array.isArray(result?.zones) ? result.zones : [];
    const zoneKey = zoneKeyFromZones(zones);
    const changed = zoneKey !== (prev.zoneKey ?? '');

    setCurrentExperienceZoneResult({
      coords: { lat, lng },
      zones,
      error: result ? null : 'Failed to resolve experience zones',
    });

    return { zones, zoneKey, changed };
  } catch (err) {
    if (options.signal?.aborted) {
      setCurrentExperienceZoneLoading(false);
      return {
        zones: prev.zones,
        zoneKey: prev.zoneKey ?? '',
        changed: false,
      };
    }
    setCurrentExperienceZoneResult({
      coords: { lat, lng },
      zones: prev.zones,
      error: err instanceof Error ? err.message : 'Failed to resolve experience zones',
    });
    return {
      zones: prev.zones,
      zoneKey: prev.zoneKey ?? '',
      changed: false,
    };
  }
}
