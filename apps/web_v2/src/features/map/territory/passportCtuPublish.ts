/**
 * Passport-frame CTU publish — only unlocked + adjacent polygons hit the map.
 * Far fog is ONE Minnesota-with-holes polygon (not 2k+ far CTU fills).
 */

import mask from '@turf/mask';
import union from '@turf/union';
import { featureCollection } from '@turf/helpers';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import {
  EXPLORE_TIER,
  EXPLORE_TIER_PROP,
  stampPassportTiers,
} from '@/features/map/territory/passportTiers';

export const PASSPORT_FAR_FOG_ID = '__passport_far_fog__';

/** Feature property stamped onto GeoJSON to indicate unlock status. */
export const EXPLORE_UNLOCKED_PROP = 'ftl_unlocked' as const;

let minnesotaCache: Feature<Polygon | MultiPolygon> | null = null;
let minnesotaLoad: Promise<Feature<Polygon | MultiPolygon> | null> | null = null;

async function loadMinnesotaPolygon(): Promise<Feature<Polygon | MultiPolygon> | null> {
  if (minnesotaCache) return minnesotaCache;
  if (minnesotaLoad) return minnesotaLoad;

  minnesotaLoad = (async () => {
    try {
      const res = await fetch('/api/civic/state-boundary', { cache: 'force-cache' });
      if (!res.ok) return null;
      const json = (await res.json()) as { minnesota?: FeatureCollection };
      const f = json.minnesota?.features?.[0];
      if (
        !f?.geometry ||
        (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')
      ) {
        return null;
      }
      minnesotaCache = f as Feature<Polygon | MultiPolygon>;
      return minnesotaCache;
    } catch {
      return null;
    } finally {
      minnesotaLoad = null;
    }
  })();

  return minnesotaLoad;
}

function dissolvePlayable(
  features: Feature[],
): Feature<Polygon | MultiPolygon> | null {
  const polys = features.filter(
    (f) =>
      f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
  ) as Feature<Polygon | MultiPolygon>[];
  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0]!;
  try {
    const dissolved = union(featureCollection(polys));
    if (
      !dissolved?.geometry ||
      (dissolved.geometry.type !== 'Polygon' &&
        dissolved.geometry.type !== 'MultiPolygon')
    ) {
      return null;
    }
    return dissolved as Feature<Polygon | MultiPolygon>;
  } catch {
    return null;
  }
}

function buildFarFogFeature(
  minnesota: Feature<Polygon | MultiPolygon>,
  playable: Feature[],
): Feature<Polygon | MultiPolygon> | null {
  const hole = dissolvePlayable(playable);
  if (!hole) {
    // No clearings yet — solid MN fog.
    return {
      type: 'Feature',
      id: PASSPORT_FAR_FOG_ID,
      properties: {
        id: PASSPORT_FAR_FOG_ID,
        name: 'Locked Minnesota',
        ftl_unlocked: 0,
        [EXPLORE_TIER_PROP]: EXPLORE_TIER.far,
        ftl_fog: 1,
      },
      geometry: minnesota.geometry,
    };
  }

  try {
    // Minnesota with holes punched for unlocked + adjacent clearings.
    const fog = mask(
      hole as Feature<Polygon>,
      minnesota as Feature<Polygon>,
    );
    if (
      !fog?.geometry ||
      (fog.geometry.type !== 'Polygon' && fog.geometry.type !== 'MultiPolygon')
    ) {
      return null;
    }
    return {
      type: 'Feature',
      id: PASSPORT_FAR_FOG_ID,
      properties: {
        id: PASSPORT_FAR_FOG_ID,
        name: 'Locked Minnesota',
        ftl_unlocked: 0,
        [EXPLORE_TIER_PROP]: EXPLORE_TIER.far,
        ftl_fog: 1,
      },
      geometry: fog.geometry,
    };
  } catch {
    return null;
  }
}

/**
 * Stamp tiers on the full CTU cache, then publish only:
 * - unlocked + adjacent CTU polygons (interactive)
 * - one far-fog mask feature (opaque, non-interactive)
 */
export async function buildPassportCtuPublishFc(
  fullFc: FeatureCollection,
  unlockedIds: ReadonlySet<string> | undefined,
): Promise<FeatureCollection> {
  const stamped = stampPassportTiers(fullFc, unlockedIds);
  const playable = stamped.features.filter((f) => {
    const tier = f.properties?.[EXPLORE_TIER_PROP];
    return tier === EXPLORE_TIER.unlocked || tier === EXPLORE_TIER.adjacent;
  });

  const minnesota = await loadMinnesotaPolygon();
  const fog = minnesota ? buildFarFogFeature(minnesota, playable) : null;

  return {
    type: 'FeatureCollection',
    features: fog ? [...playable, fog] : playable,
  };
}
