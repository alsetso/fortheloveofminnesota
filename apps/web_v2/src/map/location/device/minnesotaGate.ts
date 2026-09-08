import { isWithinMinnesota } from '@/map/location/device/minnesotaBounds';
import type { UserCoords } from '@/map/location/device/geolocation';

/** Stable blocker copy for map click / search / route commits. */
export const OUTSIDE_MN_MESSAGE = 'Outside Minnesota';

/** Find Me GPS failure — keep “your location” voice. */
export const FIND_ME_OUTSIDE_MN_MESSAGE = 'Your location is outside Minnesota.';

export type MinnesotaRegionContext = {
  id?: string;
  text?: string;
  short_code?: string;
};

/**
 * Mapbox (or reverse) region confirm — `US-MN` or text “Minnesota”.
 * Accepts a feature with `context[]`, a context array, or a single context row.
 */
export function isMinnesotaRegion(
  input:
    | { context?: MinnesotaRegionContext[] | null; short_code?: string; text?: string }
    | MinnesotaRegionContext[]
    | MinnesotaRegionContext
    | null
    | undefined,
): boolean {
  if (input == null) return false;

  if (Array.isArray(input)) {
    const region = input.find((c) => c.id?.startsWith('region.'));
    if (!region) return false;
    return region.short_code === 'US-MN' || region.text === 'Minnesota';
  }

  if ('context' in input && input.context) {
    const region = input.context.find((c) => c.id?.startsWith('region.'));
    if (region) {
      return region.short_code === 'US-MN' || region.text === 'Minnesota';
    }
  }

  return input.short_code === 'US-MN' || input.text === 'Minnesota';
}

/** Bbox gate then optional region confirm (when Mapbox context is available). */
export function gateMinnesotaLocation(
  coords: UserCoords,
  opts?: { region?: Parameters<typeof isMinnesotaRegion>[0] },
): { ok: true } | { ok: false; message: string } {
  if (!isWithinMinnesota(coords)) {
    return { ok: false, message: OUTSIDE_MN_MESSAGE };
  }
  if (opts && 'region' in opts && opts.region != null && !isMinnesotaRegion(opts.region)) {
    return { ok: false, message: OUTSIDE_MN_MESSAGE };
  }
  return { ok: true };
}

export { isWithinMinnesota };
