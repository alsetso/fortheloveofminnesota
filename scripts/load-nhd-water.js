#!/usr/bin/env node
/**
 * NHD Water Bodies → layers.water
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

/**
 * Batched, resumable loader. Reads NHDWaterbody.shp, maps to layers.water rows,
 * inserts in batches, updates water_load_state.json after each batch.
 *
 * Usage:
 *   node scripts/load-nhd-water.js --count-only     # Print total and fcode breakdown
 *   node scripts/load-nhd-water.js [--lakes-only] [--batch-size=500] [--max-batches=N] [--dry-run]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY for RLS).
 * Run from repo root.
 */

const path = require('path');
const fs = require('fs');

const SHP_PATH = path.join(
  __dirname,
  '..',
  'minnesota_gov',
  'GIS',
  'Water',
  'water_data',
  'shp_water_national_hydrography_data',
  'NHDWaterbody.shp'
);
const STATE_PATH = path.join(__dirname, '..', 'minnesota_gov', 'GIS', 'Water', 'water_load_state.json');

const LAKES_FCODES = new Set([39000, 39001, 39004, 39005, 39006, 39009, 39010, 39011, 39012]);
const SOURCE_DATE = '2024-01-05';
const PUBLISHER = 'USGS';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    countOnly: args.includes('--count-only'),
    lakesOnly: args.includes('--lakes-only'),
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '500', 10),
    maxBatches: (() => {
      const m = args.find((a) => a.startsWith('--max-batches='))?.split('=')[1];
      return m != null ? parseInt(m, 10) : Infinity;
    })(),
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { last_nhd_feature_id: null, rows_inserted: 0, batches_done: 0, last_run_at: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/** Approximate area in m² from GeoJSON Polygon/MultiPolygon (WGS84). Used for sort order only. */
function geometryAreaSqM(geometry) {
  if (!geometry || !geometry.coordinates) return 0;
  const coords = geometry.coordinates;
  const toRad = (d) => (d * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const rings = geometry.type === 'MultiPolygon' ? coords.flat() : [coords];
  let total = 0;
  for (const ring of rings) {
    if (!ring.length) continue;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += toRad(x2 - x1) * (2 + Math.sin(toRad(y1)) + Math.sin(toRad(y2)));
    }
    total += (sum * earthRadiusM * earthRadiusM) / 2;
  }
  return Math.abs(total);
}

function featureToRow(feature, lakesOnly) {
  const p = feature.properties || {};
  const fcode = p.fcode != null ? parseInt(p.fcode, 10) : null;
  if (lakesOnly && (fcode == null || !LAKES_FCODES.has(fcode))) return null;

  const permanentId = p.permanent_ ?? p.permanent_identifier ?? null;
  if (!permanentId) return null;

  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) return null;

  return {
    feature_type: 'waterbody',
    nhd_feature_id: String(permanentId).slice(0, 40),
    gnis_id: p.gnis_id != null ? String(p.gnis_id).trim() || null : null,
    gnis_name: p.gnis_name != null ? String(p.gnis_name).trim() || null : null,
    fcode: fcode,
    ftype: p.ftype != null ? String(p.ftype) : null,
    geometry,
    description: null,
    publisher: PUBLISHER,
    source_date: SOURCE_DATE,
  };
}

async function runCountOnly(shpPath) {
  const shapefile = require('shapefile');
  let total = 0;
  const byFcode = {};

  const source = await shapefile.open(shpPath);
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const feature = result.value;
    total++;
    const fcode = feature.properties?.fcode != null ? parseInt(feature.properties.fcode, 10) : null;
    const key = fcode != null ? String(fcode) : 'null';
    byFcode[key] = (byFcode[key] || 0) + 1;
  }

  console.log('Total features:', total);
  console.log('By fcode:', JSON.stringify(byFcode, null, 2));
  const lakesTotal = Object.keys(byFcode).reduce((sum, k) => {
    const code = parseInt(k, 10);
    return sum + (LAKES_FCODES.has(code) ? byFcode[k] : 0);
  }, 0);
  console.log('Lakes/ponds only (fcode 39xxx):', lakesTotal);
}

async function runLoad(shpPath, opts) {
  const { lakesOnly, batchSize, maxBatches, dryRun } = opts;
  const shapefile = require('shapefile');
  const state = loadState();
  let lastId = state.last_nhd_feature_id;

  let supabase = null;
  if (!dryRun) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
      process.exit(1);
    }
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.log('Dry run: no inserts, no state file updates.');
  }

  console.log('Reading shapefile and mapping rows...');
  const source = await shapefile.open(shpPath);
  const rows = [];
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const row = featureToRow(result.value, lakesOnly);
    if (row) rows.push(row);
  }
  console.log('Computed area and sorting by size (largest first)...');
  rows.forEach((row) => {
    row._areaSqM = geometryAreaSqM(row.geometry);
  });
  rows.sort((a, b) => b._areaSqM - a._areaSqM);
  rows.forEach((row) => delete row._areaSqM);

  let skip = true;
  let batch = [];
  let processed = 0;
  let useInsertOnly = false; // fallback when DB has no unique on nhd_feature_id

  const insertBatch = async (batchToInsert) => {
    const table = supabase.schema('layers').from('water');
    if (!useInsertOnly) {
      const { error } = await table.upsert(batchToInsert, {
        onConflict: 'nhd_feature_id',
        ignoreDuplicates: true,
      });
      if (error) {
        if (error.code === '42P10') {
          useInsertOnly = true;
          console.warn('No unique constraint on nhd_feature_id; using insert. Run migration 20260217000000_add_water_nhd_feature_id_unique for idempotent re-runs.');
          return insertBatch(batchToInsert);
        }
        return { error };
      }
      return {};
    }
    const { error } = await table.insert(batchToInsert);
    return { error };
  };

  for (const row of rows) {
    if (skip) {
      if (state.last_nhd_feature_id === null || row.nhd_feature_id === state.last_nhd_feature_id) {
        skip = false;
        if (state.last_nhd_feature_id !== null) continue;
      } else {
        continue;
      }
    }
    batch.push(row);
    processed++;
    lastId = row.nhd_feature_id;

    if (batch.length >= batchSize) {
      if (!dryRun) {
        const { error } = await insertBatch(batch);
        if (error) {
          console.error('Insert error:', error);
          process.exit(1);
        }
        state.rows_inserted += batch.length;
        state.batches_done += 1;
        state.last_nhd_feature_id = lastId;
        state.last_run_at = new Date().toISOString();
        saveState(state);
      }
      console.log('Batch:', state.batches_done, 'Rows in batch:', batch.length, 'Total inserted:', state.rows_inserted);
      batch = [];
      if (state.batches_done >= maxBatches) break;
    }
  }

  if (batch.length > 0 && !dryRun) {
    const { error } = await insertBatch(batch);
    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }
    state.rows_inserted += batch.length;
    state.batches_done += 1;
    state.last_nhd_feature_id = lastId;
    state.last_run_at = new Date().toISOString();
    saveState(state);
    console.log('Final batch. Rows:', batch.length, 'Total inserted:', state.rows_inserted);
  } else if (batch.length > 0 && dryRun) {
    console.log('Dry run: would insert final batch of', batch.length);
  }

  console.log('Done. Processed', processed, 'features. Total rows inserted (this table):', state.rows_inserted);
  console.log('Last nhd_feature_id:', state.last_nhd_feature_id);
}

async function main() {
  const args = parseArgs();
  if (!fs.existsSync(SHP_PATH)) {
    console.error('Shapefile not found:', SHP_PATH);
    process.exit(1);
  }

  if (args.countOnly) {
    await runCountOnly(SHP_PATH);
    return;
  }

  await runLoad(SHP_PATH, args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
