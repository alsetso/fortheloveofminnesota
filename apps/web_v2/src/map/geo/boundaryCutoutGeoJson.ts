import bbox from '@turf/bbox';
import booleanValid from '@turf/boolean-valid';
import flatten from '@turf/flatten';
import { featureCollection, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import mask from '@turf/mask';
import simplify from '@turf/simplify';
import union from '@turf/union';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';

/** World-spanning outer mask — same ring as web city-page cutouts. */
const WORLD_OUTER = polygon([
  [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ],
]);

/** ~100m — keeps within-filter polygon valid and a few thousand points. */
const FILTER_SIMPLIFY_TOLERANCE = 0.001;

export type BoundaryCutoutDiagnostics = {
  sourceFeatureCount: number;
  sourceInvalidCount: number;
  sourceKinkPoints: number;
  dissolvedType: string | null;
  dissolvedValid: boolean;
  dissolvedKinks: number;
  maskType: string | null;
  maskValid: boolean;
  maskKinks: number;
  maskHolePoints: number | null;
  filterType: string | null;
  filterPoints: number | null;
  filterValid: boolean;
  filterKinks: number;
};

export type BoundaryCutoutResult = {
  /** Inverted world cutout — white fill outside MN. */
  cutout: FeatureCollection;
  /** Positive simplified MN shape — for Mapbox `within` label filters. */
  minnesota: FeatureCollection;
  /**
   * Solid rectangles covering everything outside the MN bbox (no holes).
   * Mapbox `clip` is unreliable with holed polygons; these panels hide
   * road shields / place symbols outside the state.
   */
  symbolClip: FeatureCollection;
  diagnostics: BoundaryCutoutDiagnostics;
};

/**
 * Outer frame for symbol clip panels.
 *
 * Mapbox's clip tessellator silently fails on world-sized polygons
 * (±180 / ±85). Keep this regional — large enough to cover everything
 * visible while looking at Minnesota (WI / Dakotas / Ontario / Iowa),
 * small enough that clip actually runs.
 */
export const SYMBOL_CLIP_OUTER = {
  west: -110,
  south: 38,
  east: -80,
  north: 55,
} as const;

/**
 * Four solid rectangles around an axis-aligned box — no holes.
 * Outer defaults to {@link SYMBOL_CLIP_OUTER} (not the world).
 */
export function symbolClipPanelsAroundBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  outer: {
    west: number;
    south: number;
    east: number;
    north: number;
  } = SYMBOL_CLIP_OUTER,
): FeatureCollection {
  const W = Math.min(outer.west, west - 0.01);
  const S = Math.min(outer.south, south - 0.01);
  const E = Math.max(outer.east, east + 0.01);
  const N = Math.max(outer.north, north + 0.01);
  return featureCollection([
    polygon([
      [
        [W, S],
        [west, S],
        [west, N],
        [W, N],
        [W, S],
      ],
    ]),
    polygon([
      [
        [east, S],
        [E, S],
        [E, N],
        [east, N],
        [east, S],
      ],
    ]),
    polygon([
      [
        [west, S],
        [east, S],
        [east, south],
        [west, south],
        [west, S],
      ],
    ]),
    polygon([
      [
        [west, north],
        [east, north],
        [east, N],
        [west, N],
        [west, north],
      ],
    ]),
  ]);
}

function asPolyFeature(
  f: Feature,
): Feature<Polygon | MultiPolygon> | null {
  if (!f.geometry) return null;
  if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
    return f as Feature<Polygon | MultiPolygon>;
  }
  return null;
}

function countKinks(feature: Feature): number {
  try {
    if (
      !feature.geometry ||
      (feature.geometry.type !== 'Polygon' &&
        feature.geometry.type !== 'MultiPolygon')
    ) {
      return 0;
    }
    return kinks(feature as Feature<Polygon | MultiPolygon>).features.length;
  } catch {
    return -1;
  }
}

function isValidFeature(feature: Feature): boolean {
  try {
    return booleanValid(feature);
  } catch {
    return false;
  }
}

function dissolvePolygons(
  boundary: FeatureCollection,
): Feature<Polygon | MultiPolygon> | null {
  const flat = flatten(boundary);
  const polys = flat.features
    .map(asPolyFeature)
    .filter((f): f is Feature<Polygon | MultiPolygon> => f != null);

  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0]!;

  const dissolved = union(featureCollection(polys));
  if (
    !dissolved?.geometry ||
    (dissolved.geometry.type !== 'Polygon' &&
      dissolved.geometry.type !== 'MultiPolygon')
  ) {
    return null;
  }
  return dissolved as Feature<Polygon | MultiPolygon>;
}

/**
 * Dissolve Minnesota multipolygon features, validate, then turf.mask against
 * a world bbox. Returns a FeatureCollection ready for a Mapbox fill layer
 * (white outside MN, transparent hole inside).
 *
 * No manual hole winding / point-skipping — turf owns topology.
 */
export function boundaryCutoutGeoJson(
  boundary: FeatureCollection,
): BoundaryCutoutResult {
  let sourceInvalidCount = 0;
  let sourceKinkPoints = 0;

  for (const feature of boundary.features) {
    if (!feature.geometry) continue;
    if (!isValidFeature(feature)) sourceInvalidCount += 1;
    const kinkCount = countKinks(feature);
    if (kinkCount > 0) sourceKinkPoints += kinkCount;
  }

  const dissolved = dissolvePolygons(boundary);

  const dissolvedValid = dissolved ? isValidFeature(dissolved) : false;
  const dissolvedKinks = dissolved ? countKinks(dissolved) : -1;

  const emptyDiagnostics = (
    partial: Partial<BoundaryCutoutDiagnostics>,
  ): BoundaryCutoutDiagnostics => ({
    sourceFeatureCount: boundary.features.length,
    sourceInvalidCount,
    sourceKinkPoints,
    dissolvedType: null,
    dissolvedValid: false,
    dissolvedKinks: -1,
    maskType: null,
    maskValid: false,
    maskKinks: -1,
    maskHolePoints: null,
    filterType: null,
    filterPoints: null,
    filterValid: false,
    filterKinks: -1,
    ...partial,
  });

  if (!dissolved) {
    return {
      cutout: { type: 'FeatureCollection', features: [] },
      minnesota: { type: 'FeatureCollection', features: [] },
      symbolClip: { type: 'FeatureCollection', features: [] },
      diagnostics: emptyDiagnostics({}),
    };
  }

  if (!dissolvedValid || dissolvedKinks > 0) {
    console.warn('[boundaryCutoutGeoJson] dissolved geometry issues', {
      dissolvedValid,
      dissolvedKinks,
      sourceInvalidCount,
      sourceKinkPoints,
    });
  }

  const masked = mask(dissolved, WORLD_OUTER);
  const maskValid = isValidFeature(masked);
  const maskKinksCount = countKinks(masked);

  let maskHolePoints: number | null = null;
  if (masked.geometry?.type === 'Polygon') {
    maskHolePoints = masked.geometry.coordinates[1]?.length ?? 0;
  }

  if (!maskValid || maskKinksCount > 0) {
    console.warn('[boundaryCutoutGeoJson] mask geometry issues', {
      maskValid,
      maskKinks: maskKinksCount,
    });
  }

  // Positive MN shape for `within` filters — simplify for per-label cost.
  let filterFeature = dissolved as Feature<Polygon | MultiPolygon>;
  try {
    filterFeature = simplify(dissolved, {
      tolerance: FILTER_SIMPLIFY_TOLERANCE,
      highQuality: true,
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>;
  } catch (err) {
    console.warn('[boundaryCutoutGeoJson] filter simplify failed; using full dissolve', err);
  }

  const filterValid = isValidFeature(filterFeature);
  const filterKinksCount = countKinks(filterFeature);
  let filterPoints: number | null = null;
  if (filterFeature.geometry.type === 'Polygon') {
    filterPoints = filterFeature.geometry.coordinates[0]?.length ?? 0;
  } else {
    filterPoints = filterFeature.geometry.coordinates.reduce(
      (n, poly) => n + (poly[0]?.length ?? 0),
      0,
    );
  }

  if (!filterValid || filterKinksCount > 0) {
    console.warn('[boundaryCutoutGeoJson] filter geometry issues', {
      filterValid,
      filterKinks: filterKinksCount,
      filterPoints,
    });
  }

  // Clip panels use MN bbox (+ small pad). Exact shoreline is unnecessary for
  // shield hiding; solid rects avoid Mapbox clip failing on holed polygons.
  const [minX, minY, maxX, maxY] = bbox(dissolved);
  const pad = 0.02;
  const symbolClip = symbolClipPanelsAroundBBox(
    minX - pad,
    minY - pad,
    maxX + pad,
    maxY + pad,
  );

  return {
    cutout: {
      type: 'FeatureCollection',
      features: [masked],
    },
    minnesota: {
      type: 'FeatureCollection',
      features: [filterFeature],
    },
    symbolClip,
    diagnostics: emptyDiagnostics({
      dissolvedType: dissolved.geometry.type,
      dissolvedValid,
      dissolvedKinks,
      maskType: masked.geometry?.type ?? null,
      maskValid,
      maskKinks: maskKinksCount,
      maskHolePoints,
      filterType: filterFeature.geometry.type,
      filterPoints,
      filterValid,
      filterKinks: filterKinksCount,
    }),
  };
}
