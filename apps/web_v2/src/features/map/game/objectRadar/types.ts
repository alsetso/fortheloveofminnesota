/**
 * Object Radar — shared data types (Game).
 *
 * ObjectRadar   feature root
 * ObjectMiniMap round peek (projects Range)
 * ObjectMap     full sheet (owns Range edits)
 * Range         meters from origin
 */

import type { FeatureCollection, Point } from 'geojson';
import type { ModelPurpose } from '@/features/map/game/world/modelVerbs';

/** Classic collectible slugs — still used for Collected mode + brand colors. */
export const OBJECT_RADAR_SLUGS = [
  'heart-quaternius',
  'coin-quaternius',
  'treasure-chest-safayan',
] as const;

export type ObjectRadarSlug = (typeof OBJECT_RADAR_SLUGS)[number];

/** Still out vs claimed — Object Map toggle. */
export type ObjectRadarMode = 'still-out' | 'collected';

/** Which Mapbox surface is painting. */
export type ObjectRadarSurface = 'minimap' | 'object-map';

export type ObjectRadarOrigin = {
  lng: number;
  lat: number;
  bearing: number;
};

export type ObjectRadarPoint = {
  id: string;
  lat: number;
  lng: number;
  slug: string;
  collected?: boolean;
};

export type ObjectRadarFeatureProps = {
  id: string;
  slug: string;
  collected: boolean;
  /** Catalog tap verb (resolved). */
  interaction: string;
  /** North-star purpose branch. */
  purpose: ModelPurpose;
  /** Marker / rim color (purpose or classic slug brand). */
  color: string;
  /** Human-readable catalog display name (populated for non-collectible "other" objects). */
  label?: string;
};

export type ObjectRadarFeatureCollection = FeatureCollection<
  Point,
  ObjectRadarFeatureProps
>;

/** @deprecated Prefer purpose counts — kept for classic collectible breakdown. */
export type ObjectRadarCounts = Record<ObjectRadarSlug, number>;

export const OBJECT_RADAR_LEGEND: readonly {
  slug: ObjectRadarSlug;
  label: string;
  shortLabel: string;
  color: string;
}[] = [
  {
    slug: 'heart-quaternius',
    label: 'Quaternius Heart',
    shortLabel: 'Heart',
    color: '#e85a6b',
  },
  {
    slug: 'coin-quaternius',
    label: 'Quaternius Credit',
    shortLabel: 'Credit',
    color: '#e8b84a',
  },
  {
    slug: 'treasure-chest-safayan',
    label: 'Safayan Chest',
    shortLabel: 'Chest',
    color: '#c9863a',
  },
] as const;

export const EMPTY_OBJECT_RADAR_FC: ObjectRadarFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export function emptyObjectRadarCounts(): ObjectRadarCounts {
  return {
    'heart-quaternius': 0,
    'coin-quaternius': 0,
    'treasure-chest-safayan': 0,
  };
}

export function isObjectRadarSlug(slug: string): slug is ObjectRadarSlug {
  return (OBJECT_RADAR_SLUGS as readonly string[]).includes(slug);
}
