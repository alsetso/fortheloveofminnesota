#!/usr/bin/env node
/**
 * School Buildings → civic.school_buildings
 *
 * Reads GeoJSON (pre-converted from gpkg via ogr2ogr), inserts via Supabase.
 *
 * Usage:
 *   node scripts/load-school-buildings.js --count-only
 *   node scripts/load-school-buildings.js [--dry-run]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const GEOJSON_PATH = path.join(
  __dirname, '..', 'minnesota_gov', 'GIS', 'School Data',
  'school_structures', 'school_buildings.geojson'
);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    countOnly: args.includes('--count-only'),
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '500', 10),
  };
}

function featureToRow(feature) {
  const p = feature.properties || {};
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) return null;

  const name = p.name != null ? String(p.name).trim() : null;
  if (!name) return null;

  return {
    osm_id: p.osm_id != null ? String(p.osm_id).trim() || null : null,
    name,
    address: p.address != null ? String(p.address).trim() || null : null,
    city: p.city != null ? String(p.city).trim() || null : null,
    state: p.state != null ? String(p.state).trim() || 'MN' : 'MN',
    zip: p.zip != null ? String(p.zip).trim() || null : null,
    geometry,
  };
}

async function main() {
  const args = parseArgs();

  if (!fs.existsSync(GEOJSON_PATH)) {
    console.error('GeoJSON not found:', GEOJSON_PATH);
    console.error('Run: ogr2ogr -f GeoJSON -t_srs EPSG:4326 school_buildings.geojson struc_school_buildings.gpkg');
    process.exit(1);
  }

  console.log('Reading GeoJSON...');
  const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const features = geojson.features || [];
  console.log('Total features:', features.length);

  const rows = features.map(featureToRow).filter(Boolean);
  console.log('Valid rows:', rows.length);

  if (args.countOnly) {
    const byCity = {};
    rows.forEach((r) => {
      const key = r.city || 'Unknown';
      byCity[key] = (byCity[key] || 0) + 1;
    });
    const sorted = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
    console.log('Top 20 cities:');
    sorted.slice(0, 20).forEach(([city, count]) => console.log(`  ${city}: ${count}`));
    console.log('Total unique cities:', Object.keys(byCity).length);
    return;
  }

  if (args.dryRun) {
    console.log('Dry run — first 3 rows:');
    rows.slice(0, 3).forEach((r) => {
      const { geometry, ...rest } = r;
      console.log(rest, '(geometry type:', geometry.type, ')');
    });
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { batchSize } = args;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.schema('civic').from('school_buildings').insert(batch);
    if (error) {
      console.error('Insert error at batch', Math.floor(i / batchSize) + 1, ':', error);
      process.exit(1);
    }
    inserted += batch.length;
    console.log('Batch', Math.floor(i / batchSize) + 1, '—', inserted, '/', rows.length, 'inserted');
  }

  console.log('Done.', inserted, 'rows inserted into civic.school_buildings');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
