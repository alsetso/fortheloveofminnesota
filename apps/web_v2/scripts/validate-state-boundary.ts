/**
 * One-off: validate territory.state geometry + build turf.mask cutout.
 * Run: pnpm exec tsx scripts/validate-state-boundary.ts
 */
import { createClient } from '@supabase/supabase-js';
import booleanValid from '@turf/boolean-valid';
import flatten from '@turf/flatten';
import { featureCollection, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import mask from '@turf/mask';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import union from '@turf/union';

const WORLD_MASK = polygon([[
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]]);

function asPolyFeature(
  f: Feature,
): Feature<Polygon | MultiPolygon> | null {
  if (!f.geometry) return null;
  if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
    return f as Feature<Polygon | MultiPolygon>;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const db = createClient(url, key, {
    db: { schema: 'territory' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db
    .from('state')
    .select('id, name, geometry')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.geometry) throw new Error('No geometry');

  const fc = data.geometry as FeatureCollection;
  console.log('=== RAW SOURCE ===');
  console.log('features:', fc.features.length);
  console.log(
    'geom types:',
    [...new Set(fc.features.map((f) => f.geometry?.type))],
  );

  let invalidFeatures = 0;
  let totalKinks = 0;
  const perFeature: Array<{ i: number; valid: boolean; kinks: number }> = [];

  for (let i = 0; i < fc.features.length; i++) {
    const f = fc.features[i]!;
    if (!f.geometry) continue;
    let valid = true;
    let kinkCount = 0;
    try {
      valid = booleanValid(f);
    } catch {
      valid = false;
    }
    try {
      kinkCount = kinks(f as Feature<Polygon | MultiPolygon>).features.length;
    } catch {
      kinkCount = -1;
    }
    if (!valid) invalidFeatures += 1;
    if (kinkCount > 0) totalKinks += kinkCount;
    if (!valid || kinkCount !== 0) {
      perFeature.push({ i, valid, kinks: kinkCount });
    }
  }

  console.log('invalid features:', invalidFeatures);
  console.log('features with kinks / kink total:', perFeature.length, totalKinks);
  if (perFeature.length) {
    console.log('problem features (index, valid, kinks):', perFeature.slice(0, 20));
  }

  // Flatten + dissolve
  const flat = flatten(fc);
  const polys = flat.features
    .map(asPolyFeature)
    .filter((f): f is Feature<Polygon | MultiPolygon> => f != null);

  console.log('\n=== DISSOLVE ===');
  console.log('flattened polygons:', polys.length);

  let dissolved: Feature<Polygon | MultiPolygon> | null = null;
  if (polys.length === 1) {
    dissolved = polys[0]!;
  } else {
    dissolved = union(featureCollection(polys)) as Feature<
      Polygon | MultiPolygon
    > | null;
  }

  if (!dissolved?.geometry) {
    console.error('union failed');
    process.exit(1);
  }

  let dissolvedValid = false;
  let dissolvedKinks = 0;
  try {
    dissolvedValid = booleanValid(dissolved);
  } catch {
    dissolvedValid = false;
  }
  try {
    dissolvedKinks = kinks(dissolved).features.length;
  } catch {
    dissolvedKinks = -1;
  }

  console.log('dissolved type:', dissolved.geometry.type);
  console.log('dissolved booleanValid:', dissolvedValid);
  console.log('dissolved kinks:', dissolvedKinks);
  if (dissolved.geometry.type === 'MultiPolygon') {
    console.log(
      'dissolved polygon parts:',
      dissolved.geometry.coordinates.length,
    );
  } else if (dissolved.geometry.type === 'Polygon') {
    console.log(
      'dissolved rings (outer+holes):',
      dissolved.geometry.coordinates.length,
    );
  }

  console.log('\n=== MASK ===');
  const cutout = mask(dissolved, WORLD_MASK);
  let maskValid = false;
  let maskKinks = 0;
  try {
    maskValid = booleanValid(cutout);
  } catch {
    maskValid = false;
  }
  try {
    maskKinks = kinks(cutout as Feature<Polygon | MultiPolygon>).features.length;
  } catch {
    maskKinks = -1;
  }
  console.log('mask type:', cutout.geometry?.type);
  console.log('mask booleanValid:', maskValid);
  console.log('mask kinks:', maskKinks);
  if (cutout.geometry?.type === 'Polygon') {
    console.log(
      'mask rings (outer+holes):',
      cutout.geometry.coordinates.length,
    );
    console.log(
      'mask outer ring points:',
      cutout.geometry.coordinates[0]?.length,
    );
  } else if (cutout.geometry?.type === 'MultiPolygon') {
    console.log('mask multipolygon parts:', cutout.geometry.coordinates.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
