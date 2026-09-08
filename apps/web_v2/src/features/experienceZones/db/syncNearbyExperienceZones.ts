/**
 * Resolve approaching experience zones near Find Me (not covering).
 */

import {
  clearNearbyExperienceZones,
  getNearbyExperienceZoneSnapshot,
  nearbyZoneKeyFromZones,
  setNearbyExperienceZoneLoading,
  setNearbyExperienceZoneResult,
} from '@/features/experienceZones/store/nearbyExperienceZoneStore';
import {
  EXPERIENCE_ZONE_APPROACH_RADIUS_M,
  fetchExperienceZonesNearPoint,
} from '@/lib/experienceZones/fetchExperienceZonesNearPoint';
import type { ExperienceZoneNearItem } from '@/lib/experienceZones/experienceZoneTypes';

export type SyncNearbyExperienceZoneResult = {
  zones: ExperienceZoneNearItem[];
  zoneKey: string;
  changed: boolean;
};

export async function syncNearbyExperienceZones(
  lat: number,
  lng: number,
  options: {
    signal?: AbortSignal;
    /** Skip near fetch when already inside a zone. */
    inside?: boolean;
    radiusM?: number;
  } = {},
): Promise<SyncNearbyExperienceZoneResult> {
  const prev = getNearbyExperienceZoneSnapshot();

  if (options.inside) {
    clearNearbyExperienceZones();
    return { zones: [], zoneKey: '', changed: (prev.zoneKey ?? '') !== '' };
  }

  setNearbyExperienceZoneLoading(true);

  try {
    const result = await fetchExperienceZonesNearPoint(
      lat,
      lng,
      options.radiusM ?? EXPERIENCE_ZONE_APPROACH_RADIUS_M,
      options.signal,
    );
    if (options.signal?.aborted) {
      setNearbyExperienceZoneLoading(false);
      return {
        zones: prev.zones,
        zoneKey: prev.zoneKey ?? '',
        changed: false,
      };
    }

    const zones = Array.isArray(result?.zones) ? result.zones : [];
    const zoneKey = nearbyZoneKeyFromZones(zones);
    const changed = zoneKey !== (prev.zoneKey ?? '');

    setNearbyExperienceZoneResult({
      coords: { lat, lng },
      zones,
      error: result ? null : 'Failed to resolve nearby experience zones',
    });

    return { zones, zoneKey, changed };
  } catch (err) {
    if (options.signal?.aborted) {
      setNearbyExperienceZoneLoading(false);
      return {
        zones: prev.zones,
        zoneKey: prev.zoneKey ?? '',
        changed: false,
      };
    }
    setNearbyExperienceZoneResult({
      coords: { lat, lng },
      zones: prev.zones,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to resolve nearby experience zones',
    });
    return {
      zones: prev.zones,
      zoneKey: prev.zoneKey ?? '',
      changed: false,
    };
  }
}
