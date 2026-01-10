#!/usr/bin/env tsx
/**
 * Extract CTU boundaries from GeoPackage using Node.js
 * Reads GeoPackage as SQLite and extracts geometry using WKB parsing
 */

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const GPKG_PATH = join(process.cwd(), 'minnesota_gov', 'gpkg_bdry_mn_city_township_unorg', 'bdry_mn_city_township_unorg.gpkg');
const OUTPUT_PATH = join(process.cwd(), 'temp_ctu_data.json');

/**
 * Parse GeoPackage binary geometry format to GeoJSON
 * GeoPackage uses a specific binary format: magic (2 bytes) + version (1) + flags (1) + envelope + geometry
 */
function parseGPKGGeometry(blob: Buffer): any {
  if (!blob || blob.length < 8) {
    return null;
  }

  // Check magic number (GP - GeoPackage)
  const magic = blob.readUInt16BE(0);
  if (magic !== 0x4750) {
    console.warn('Invalid GPKG magic number');
    return null;
  }

  // For now, we'll use a library approach or convert via PostGIS
  // The binary format is complex - let's try using PostGIS functions via Supabase
  return null;
}

/**
 * Extract CTU data and use PostGIS to convert geometry
 */
async function extractCTUData() {
  console.log('📦 Opening GeoPackage file...');
  
  const db = new Database(GPKG_PATH, { readonly: true });
  
  try {
    // Get all CTU records with geometry blob
    const rows = db.prepare(`
      SELECT 
        CTU_CLASS,
        FEATURE_NAME,
        GNIS_FEATURE_ID,
        COUNTY_NAME,
        COUNTY_CODE,
        COUNTY_GNIS_FEATURE_ID,
        POPULATION,
        SHAPE
      FROM city_township_unorg
      WHERE CTU_CLASS IS NOT NULL
        AND FEATURE_NAME IS NOT NULL
        AND COUNTY_NAME IS NOT NULL
        AND COUNTY_NAME != 'NV'
      ORDER BY CTU_CLASS, FEATURE_NAME
    `).all() as any[];

    console.log(`✅ Found ${rows.length} CTU records`);

    // For each record, we'll store the geometry blob
    // and convert it using PostGIS ST_AsGeoJSON in the database
    const records = rows.map((row, idx) => ({
      ctu_class: row.CTU_CLASS,
      feature_name: row.FEATURE_NAME,
      gnis_feature_id: row.GNIS_FEATURE_ID ? String(row.GNIS_FEATURE_ID) : null,
      county_name: row.COUNTY_NAME,
      county_code: row.COUNTY_CODE ? String(row.COUNTY_CODE) : null,
      county_gnis_feature_id: row.COUNTY_GNIS_FEATURE_ID ? String(row.COUNTY_GNIS_FEATURE_ID) : null,
      population: row.POPULATION ? parseInt(row.POPULATION) : null,
      acres: null,
      geometry_blob: row.SHAPE ? Buffer.from(row.SHAPE).toString('base64') : null,
    }));

    // Write records with base64-encoded geometry blobs
    // We'll convert these in the import script using PostGIS
    writeFileSync(OUTPUT_PATH, JSON.stringify(records, null, 2));
    
    console.log(`✅ Extracted ${records.length} records (geometry will be converted via PostGIS)`);
    return records.length;
  } finally {
    db.close();
  }
}

extractCTUData().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

