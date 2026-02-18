#!/usr/bin/env node
/**
 * School District Boundaries → layers.school_districts
 *
 * Two-step: ogr2ogr converts GeoPackage (NAD83 UTM 15N → WGS84), then Node inserts via Supabase.
 * 329 district boundary records.
 *
 * Usage:
 *   node scripts/load-school-districts.js --count-only
 *   node scripts/load-school-districts.js [--dry-run]
 *
 * Requires: ogr2ogr (GDAL) on PATH.
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const GPKG_PATH = path.join(
  __dirname, '..', 'minnesota_gov', 'GIS', 'School Data',
  'school_districts', 'bdry_school_district_boundaries.gpkg'
);
const GEOJSON_PATH = path.join(
  __dirname, '..', 'minnesota_gov', 'GIS', 'School Data',
  'school_districts', 'school_district_boundaries.geojson'
);
const SOURCE_DATE = '2025-10-08';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    countOnly: args.includes('--count-only'),
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '500', 10),
  };
}

function convertGpkgToGeojson() {
  if (fs.existsSync(GEOJSON_PATH)) {
    console.log('GeoJSON already exists, skipping ogr2ogr. Delete to reconvert.');
    return;
  }
  console.log('Converting GeoPackage → GeoJSON (reprojecting to WGS84)...');
  execSync(
    `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${GEOJSON_PATH}" "${GPKG_PATH}" school_district_boundaries`,
    { stdio: 'inherit' }
  );
  console.log('Conversion complete.');
}

function featureToRow(feature) {
  const p = feature.properties || {};
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) return null;

  const sdnumber = p.sdnumber != null ? String(p.sdnumber).trim() : null;
  const prefname = p.prefname != null ? String(p.prefname).trim() : null;
  if (!sdnumber || !prefname) return null;

  return {
    sd_org_id: p.sdorgid != null ? String(p.sdorgid) : null,
    form_id: p.formid != null ? String(p.formid).trim() || null : null,
    sd_type: p.sdtype != null ? String(p.sdtype).trim() || null : null,
    sd_number: sdnumber,
    name: prefname,
    short_name: p.shortname != null ? String(p.shortname).trim() || null : null,
    web_url: p.web_url != null ? String(p.web_url).trim() || null : null,
    sq_miles: p.sqmiles != null ? Number(p.sqmiles) : null,
    acres: p.acres != null ? Number(p.acres) : null,
    geometry,
    source_date: SOURCE_DATE,
  };
}

async function main() {
  const args = parseArgs();

  if (!fs.existsSync(GPKG_PATH)) {
    console.error('GeoPackage not found:', GPKG_PATH);
    process.exit(1);
  }

  convertGpkgToGeojson();

  console.log('Reading GeoJSON...');
  const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const features = geojson.features || [];
  console.log('Total features:', features.length);

  // Group by sd_number and merge multi-feature districts into single MultiPolygon
  const grouped = new Map();
  for (const feature of features) {
    const row = featureToRow(feature);
    if (!row) continue;
    const key = row.sd_number;
    if (!grouped.has(key)) {
      grouped.set(key, row);
    } else {
      const existing = grouped.get(key);
      // Merge coordinates into one MultiPolygon
      const existingCoords = existing.geometry.type === 'MultiPolygon'
        ? existing.geometry.coordinates
        : [existing.geometry.coordinates];
      const newCoords = row.geometry.type === 'MultiPolygon'
        ? row.geometry.coordinates
        : [row.geometry.coordinates];
      existing.geometry = {
        type: 'MultiPolygon',
        coordinates: [...existingCoords, ...newCoords],
      };
    }
  }
  const rows = Array.from(grouped.values());
  console.log('Valid rows (merged):', rows.length, '(from', features.length, 'features)');

  if (args.countOnly) {
    const byType = {};
    rows.forEach((r) => {
      const key = r.sd_type || 'null';
      byType[key] = (byType[key] || 0) + 1;
    });
    console.log('By sd_type:', JSON.stringify(byType, null, 2));
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
    const { error } = await supabase.schema('layers').from('school_districts').upsert(batch, { onConflict: 'sd_number' });
    if (error) {
      console.error('Insert error at batch', Math.floor(i / batchSize) + 1, ':', error);
      process.exit(1);
    }
    inserted += batch.length;
    console.log('Batch', Math.floor(i / batchSize) + 1, '—', inserted, '/', rows.length, 'inserted');
  }

  console.log('Done.', inserted, 'rows inserted into layers.school_districts');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
