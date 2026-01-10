#!/usr/bin/env tsx
/**
 * Test CTU boundaries import with a single city and township
 * Uses PostGIS to convert geometry from GeoPackage binary format
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { join } from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const GPKG_PATH = join(process.cwd(), 'minnesota_gov', 'gpkg_bdry_mn_city_township_unorg', 'bdry_mn_city_township_unorg.gpkg');
const TEMP_JSON_PATH = join(process.cwd(), 'temp_ctu_test.json');

interface CTUFeature {
  ctu_class: 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY';
  feature_name: string;
  gnis_feature_id: string | null;
  county_name: string;
  county_code: string | null;
  county_gnis_feature_id: string | null;
  population: number | null;
  acres: number | null;
  geometry_blob_hex?: string; // Hex-encoded geometry blob for PostGIS conversion
}

async function extractTestRecords(): Promise<CTUFeature[]> {
  console.log('🔄 Extracting test records from GeoPackage...');
  
  const pythonScript = `
import sqlite3
import json
import sys

gpkg_path = r"${GPKG_PATH.replace(/\\/g, '\\\\')}"
output_path = r"${TEMP_JSON_PATH.replace(/\\/g, '\\\\')}"

conn = sqlite3.connect(gpkg_path)
cursor = conn.cursor()

# Find 1 city and 1 township
cursor.execute("""
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
    AND SHAPE IS NOT NULL
  ORDER BY CTU_CLASS, FEATURE_NAME
""")

records = []
city_found = False
township_found = False

for row in cursor.fetchall():
    ctu_class, feature_name, gnis_id, county_name, county_code, county_gnis_id, population, shape_blob = row
    
    if ctu_class == 'CITY' and not city_found:
        records.append({
            "ctu_class": ctu_class,
            "feature_name": feature_name,
            "gnis_feature_id": str(gnis_id) if gnis_id else None,
            "county_name": county_name,
            "county_code": str(county_code) if county_code else None,
            "county_gnis_feature_id": str(county_gnis_id) if county_gnis_id else None,
            "population": int(population) if population else None,
            "acres": None,
            "geometry_blob_hex": shape_blob.hex() if shape_blob else None
        })
        city_found = True
        print(f"Found city: {feature_name}")
    
    if ctu_class == 'TOWNSHIP' and not township_found:
        records.append({
            "ctu_class": ctu_class,
            "feature_name": feature_name,
            "gnis_feature_id": str(gnis_id) if gnis_id else None,
            "county_name": county_name,
            "county_code": str(county_code) if county_code else None,
            "county_gnis_feature_id": str(county_gnis_id) if county_gnis_id else None,
            "population": int(population) if population else None,
            "acres": None,
            "geometry_blob_hex": shape_blob.hex() if shape_blob else None
        })
        township_found = True
        print(f"Found township: {feature_name}")
    
    if city_found and township_found:
        break

conn.close()

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2)

print(f"Extracted {len(records)} test records")
`;

  const pythonScriptPath = join(process.cwd(), 'scripts', 'extract_test_ctu.py');
  writeFileSync(pythonScriptPath, pythonScript);
  
  try {
    execSync(`python3 "${pythonScriptPath}"`, { stdio: 'inherit' });
    
    if (!existsSync(TEMP_JSON_PATH)) {
      throw new Error('Python script did not create output file');
    }
    
    const testRecords: CTUFeature[] = JSON.parse(readFileSync(TEMP_JSON_PATH, 'utf-8'));
    unlinkSync(TEMP_JSON_PATH);
    if (existsSync(pythonScriptPath)) {
      unlinkSync(pythonScriptPath);
    }
    
    if (testRecords.length !== 2) {
      throw new Error(`Expected 2 test records, got ${testRecords.length}`);
    }
    
    console.log(`✅ Extracted ${testRecords.length} test records\n`);
    for (const record of testRecords) {
      console.log(`   - ${record.feature_name} (${record.ctu_class}): ${record.geometry_blob_hex ? `${record.geometry_blob_hex.length / 2} bytes` : 'no geometry'}`);
    }
    
    return testRecords;
  } catch (error: any) {
    // Clean up on error
    try {
      if (existsSync(TEMP_JSON_PATH)) unlinkSync(TEMP_JSON_PATH);
      if (existsSync(pythonScriptPath)) unlinkSync(pythonScriptPath);
    } catch {}
    throw error;
  }
}

async function testImport() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing CTU boundaries import with 1 city and 1 township...\n');
  console.log('   Using PostGIS to convert geometry from GeoPackage binary format\n');

  try {
    const testRecords = await extractTestRecords();

    // Clear existing test data
    console.log('\n🗑️  Clearing any existing test records...');
    const { error: deleteError } = await supabase
      .schema('civic')
      .from('ctu_boundaries')
      .delete()
      .in('feature_name', testRecords.map(r => r.feature_name));

    if (deleteError) {
      console.warn('⚠️  Warning: Could not clear existing test data:', deleteError.message);
    } else {
      console.log('✅ Cleared existing test data');
    }

    // Import using PostGIS to convert geometry
    console.log('\n📥 Importing test records with PostGIS geometry conversion...');
    
    for (const record of testRecords) {
      // Try using the RPC function first
      const { data: rpcData, error: rpcError } = await supabase.rpc('import_ctu_with_geometry', {
        p_ctu_class: record.ctu_class,
        p_feature_name: record.feature_name,
        p_gnis_feature_id: record.gnis_feature_id,
        p_county_name: record.county_name,
        p_county_code: record.county_code,
        p_county_gnis_feature_id: record.county_gnis_feature_id,
        p_population: record.population,
        p_geometry_blob_hex: record.geometry_blob_hex
      });

      if (rpcError) {
        // If RPC doesn't exist, try direct insert with geometry conversion
        console.log(`   Attempting direct insert for ${record.feature_name}...`);
        
        // Convert hex blob to PostGIS geometry, then to GeoJSON
        const { data: geomData, error: geomError } = await supabase.rpc('gpkg_blob_to_geojson', {
          p_blob_hex: record.geometry_blob_hex
        });

        if (geomError) {
          console.error(`   ❌ Error converting geometry for ${record.feature_name}:`, geomError.message);
          // Continue with placeholder geometry for testing
          const { data: insertData, error: insertError } = await supabase
            .schema('civic')
            .from('ctu_boundaries')
            .insert({
              ctu_class: record.ctu_class,
              feature_name: record.feature_name,
              gnis_feature_id: record.gnis_feature_id,
              county_name: record.county_name,
              county_code: record.county_code,
              county_gnis_feature_id: record.county_gnis_feature_id,
              population: record.population,
              acres: record.acres,
              geometry: {
                type: 'FeatureCollection',
                features: []
              }
            })
            .select();

          if (insertError) {
            console.error(`   ❌ Error inserting ${record.feature_name}:`, insertError.message);
          } else {
            console.log(`   ⚠️  Inserted ${record.feature_name} without geometry (conversion failed - RPC may not exist)`);
          }
        } else {
          // Insert with converted geometry
          const { data: insertData, error: insertError } = await supabase
            .schema('civic')
            .from('ctu_boundaries')
            .insert({
              ctu_class: record.ctu_class,
              feature_name: record.feature_name,
              gnis_feature_id: record.gnis_feature_id,
              county_name: record.county_name,
              county_code: record.county_code,
              county_gnis_feature_id: record.county_gnis_feature_id,
              population: record.population,
              acres: record.acres,
              geometry: geomData
            })
            .select();

          if (insertError) {
            console.error(`   ❌ Error inserting ${record.feature_name}:`, insertError.message);
          } else {
            console.log(`   ✅ Inserted ${record.feature_name} with geometry`);
          }
        }
      } else {
        console.log(`   ✅ Inserted ${record.feature_name} via RPC`);
      }
    }

    // Verify imported data
    console.log('\n🔍 Verifying imported data...');
    const { data: verifyData, error: verifyError } = await supabase
      .schema('civic')
      .from('ctu_boundaries')
      .select('id, ctu_class, feature_name, geometry')
      .in('feature_name', testRecords.map(r => r.feature_name));

    if (verifyError) {
      console.error('❌ Error verifying data:', verifyError);
    } else {
      console.log(`   ✅ Found ${verifyData?.length || 0} records in database`);
      for (const record of verifyData || []) {
        const geom = record.geometry;
        if (geom && geom.type === 'FeatureCollection' && geom.features && geom.features.length > 0) {
          const feature = geom.features[0];
          const hasCoords = feature.geometry?.coordinates && 
            Array.isArray(feature.geometry.coordinates) && 
            feature.geometry.coordinates.length > 0;
          console.log(`   ✅ ${record.feature_name}: ${feature.geometry.type} with ${hasCoords ? 'coordinates' : 'no coordinates'}`);
        } else {
          console.log(`   ⚠️  ${record.feature_name}: Invalid or empty geometry`);
        }
      }
    }

    console.log('\n✨ Test import complete!');
    console.log('   Review the geometry above. If it looks good, proceed with full import.');

  } catch (error) {
    console.error('\n❌ Test import failed:', error);
    process.exit(1);
  }
}

// Run test
testImport().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
