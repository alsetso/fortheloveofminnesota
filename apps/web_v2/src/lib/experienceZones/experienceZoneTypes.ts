/** Active experience zone returned by experience_zone_at_point. */
import type { MultiPolygon, Polygon } from 'geojson';

export type ExperienceZoneAtPointItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Explicit parent when authored as a sub-zone. */
  parent_zone_id?: string | null;
  parent_name?: string | null;
  /**
   * Who can see this zone.
   * - `public`  — visible to everyone on the map.
   * - `invite`  — visible only to invited accounts.
   * - `private` — staff / admin only; never shown to regular users.
   */
  visibility: 'public' | 'invite' | 'private';
  /**
   * Whether community pins can be contributed while exploring this zone.
   * When false, the contribute sheet is blocked with a friendly message.
   * Does not affect existing posts.
   */
  allow_contributions: boolean;
};

export type ExperienceZoneAtPointResult = {
  zones: ExperienceZoneAtPointItem[];
};

/** Active primary zone near (not covering) the point — approach chrome. */
export type ExperienceZoneNearItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  distance_m: number;
  label_lng: number;
  label_lat: number;
  geometry: Polygon | MultiPolygon | null;
};

export type ExperienceZoneNearResult = {
  zones: ExperienceZoneNearItem[];
};

/** Active primary zone for Object Map / radar overlays + Discover. */
export type ExperienceZoneListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Play hub curation flag — only featured primary zones appear on `/map`. */
  featured: boolean;
  geometry: Polygon | MultiPolygon | null;
};

export type ExperienceZoneListResult = {
  zones: ExperienceZoneListItem[];
};

/**
 * Resolved zone hierarchy for a given point.
 *
 * `primaryZone` — the parent zone (or sole zone when no nesting). This drives
 * all data/control: placement stream scope, camera lock, banner headline.
 *
 * `subZone` — the specific sub-zone the user is standing in, if any. Used only
 * as a positional badge ("In Gate A") and for the inner boundary ring on the
 * Object Map. All major experience-zone controls run on the primary zone.
 */
export type ZoneHierarchy = {
  primaryZone: ExperienceZoneAtPointItem;
  subZone: ExperienceZoneAtPointItem | null;
};

/**
 * Resolve the zone hierarchy from the at-point result.
 *
 * Zones come back area-asc (smallest first). If the smallest zone has an
 * explicit `parent_zone_id` and that parent is in the returned set, treat the
 * parent as primary and the smallest as the sub-zone positional indicator.
 * Otherwise the smallest zone is the sole primary context.
 */
export function resolveZoneHierarchy(
  zones: ExperienceZoneAtPointItem[],
): ZoneHierarchy | null {
  if (zones.length === 0) return null;

  const leaf = zones[0];

  if (leaf.parent_zone_id) {
    const parent =
      zones.find((z) => z.id === leaf.parent_zone_id) ??
      // Parent may carry a name even if not in the covering set (edge case).
      (leaf.parent_name
        ? {
            id: leaf.parent_zone_id,
            slug: '',
            name: leaf.parent_name,
            description: null,
            parent_zone_id: null,
            visibility: leaf.visibility,
            allow_contributions: leaf.allow_contributions,
          }
        : null);

    if (parent) return { primaryZone: parent, subZone: leaf };
  }

  return { primaryZone: leaf, subZone: null };
}

