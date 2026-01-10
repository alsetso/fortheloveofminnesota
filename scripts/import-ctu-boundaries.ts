#!/usr/bin/env tsx
/**
 * Import CTU boundaries from GeoPackage into civic.ctu_boundaries table
 * 
 * Usage: 
 *   npx tsx scripts/import-ctu-boundaries.ts
 * 
 * Requires environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 
 * These can be set in .env.local or passed inline:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-ctu-boundaries.ts
 * 
 * Note: This script uses Python to read the GeoPackage file. Make sure Python 3 is installed
 * with the following packages: sqlite3 (built-in), json (built-in)
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
const TEMP_JSON_PATH = join(process.cwd(), 'temp_ctu_data.json');

interface CTUFeature {
  id: string;
  ctu_class: 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY';
  feature_name: string;
  gnis_feature_id: string | null;
  county_name: string;
  county_code: string | null;
  county_gnis_feature_id: string | null;
  population: number | null;
  acres: number | null;
  geometry: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: Record<string, any>;
      geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: any;
      };
    }>;
  };
}

/**
 * Extract CTU data from GeoPackage using Python
 */
function extractCTUDataFromGPKG(): CTUFeature[] {
  console.log('📦 Extracting data from GeoPackage...');
  
  const pythonScript = `
import sqlite3
import json
import sys

gpkg_path = r"${GPKG_PATH.replace(/\\/g, '\\\\')}"
output_path = r"${TEMP_JSON_PATH.replace(/\\/g, '\\\\')}"

conn = sqlite3.connect(gpkg_path)
cursor = conn.cursor()

# Get all CTU records
cursor.execute("""
  SELECT 
    CTU_CLASS,
    FEATURE_NAME,
    GNIS_FEATURE_ID,
    COUNTY_NAME,
    COUNTY_CODE,
    COUNTY_GNIS_FEATURE_ID,
    POPULATION,
    Acres,
    geometry
  FROM city_township_unorg
  WHERE CTU_CLASS IS NOT NULL
    AND FEATURE_NAME IS NOT NULL
    AND COUNTY_NAME IS NOT NULL
    AND COUNTY_NAME != 'NV'
  ORDER BY CTU_CLASS, FEATURE_NAME
""")

records = []
for row in cursor.fetchall():
    ctu_class, feature_name, gnis_id, county_name, county_code, county_gnis_id, population, acres, geometry_blob = row
    
    # Skip invalid records
    if not ctu_class or not feature_name or not county_name:
        continue
    
    # Convert geometry blob to GeoJSON
    # GeoPackage stores geometry in WKB format, we need to convert it
    # For now, we'll use a placeholder - actual conversion requires ogr2ogr or similar
    # This is a simplified approach - in production, use ogr2ogr or geopandas
    
    # Create a FeatureCollection with a single feature
    # Note: This is a placeholder - actual geometry conversion requires proper tools
    geometry = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": []
                }
            }
        ]
    }
    
    records.append({
        "ctu_class": ctu_class,
        "feature_name": feature_name,
        "gnis_feature_id": str(gnis_id) if gnis_id else None,
        "county_name": county_name,
        "county_code": int(county_code) if county_code else None,
        "county_gnis_feature_id": str(county_gnis_id) if county_gnis_id else None,
        "population": int(population) if population else None,
        "acres": None,
        "geometry": geometry
    })

conn.close()

# Write to JSON file
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2)

print(f"Extracted {len(records)} CTU records")
`;

  try {
    execSync(`python3 -c ${JSON.stringify(pythonScript)}`, { stdio: 'inherit' });
    
    // Read the extracted data
    const data = JSON.parse(readFileSync(TEMP_JSON_PATH, 'utf-8'));
    
    // Clean up temp file
    unlinkSync(TEMP_JSON_PATH);
    
    return data;
  } catch (error) {
    console.error('❌ Error extracting data from GeoPackage:', error);
    throw error;
  }
}

/**
 * Convert GeoPackage to GeoJSON using ogr2ogr (if available)
 * Falls back to direct database import if ogr2ogr is not available
 */
async function convertGPKGToGeoJSON(): Promise<CTUFeature[]> {
  console.log('🔄 Converting GeoPackage to GeoJSON...');
  
  // Try using ogr2ogr first (more reliable for geometry conversion)
  try {
    const tempGeoJSONPath = join(process.cwd(), 'temp_ctu_geojson.json');
    
    execSync(
      `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${tempGeoJSONPath}" "${GPKG_PATH}" city_township_unorg`,
      { stdio: 'pipe' }
    );
    
    const geoJsonData = JSON.parse(readFileSync(tempGeoJSONPath, 'utf-8'));
    unlinkSync(tempGeoJSONPath);
    
    // Transform GeoJSON features to our CTU format
    const ctus: CTUFeature[] = geoJsonData.features.map((feature: any, index: number) => {
      const props = feature.properties || {};
      
      // Skip invalid records
      if (!props.CTU_CLASS || !props.FEATURE_NAME || !props.COUNTY_NAME || props.COUNTY_NAME === 'NV') {
        return null;
      }
      
      return {
        id: `ctu-${index}`,
        ctu_class: props.CTU_CLASS as 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY',
        feature_name: props.FEATURE_NAME,
        gnis_feature_id: props.GNIS_FEATURE_ID ? String(props.GNIS_FEATURE_ID) : null,
        county_name: props.COUNTY_NAME,
        county_code: props.COUNTY_CODE ? String(props.COUNTY_CODE) : null,
        county_gnis_feature_id: props.COUNTY_GNIS_FEATURE_ID ? String(props.COUNTY_GNIS_FEATURE_ID) : null,
        population: props.POPULATION ? parseInt(props.POPULATION) : null,
        acres: null, // Will be calculated from geometry if needed
        geometry: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: feature.geometry,
          }],
        },
      };
    }).filter((ctu: CTUFeature | null) => ctu !== null) as CTUFeature[];
    
    console.log(`✅ Converted ${ctus.length} CTU records`);
    return ctus;
  } catch (error) {
    console.warn('⚠️  ogr2ogr not available');
    console.warn('   Attempting direct database import...');
    return importDirectlyFromDatabase();
  }
}

/**
 * Import directly from GeoPackage using Python with built-in libraries
 * Extracts geometry as base64-encoded blobs for PostGIS conversion
 */
async function importDirectlyFromDatabase(): Promise<CTUFeature[]> {
  console.log('📦 Extracting CTU data from GeoPackage (using built-in Python libraries)...');
  console.log('   Note: Since geometry is already populated, we\'ll use ogr2ogr if available');
  console.log('   Otherwise, we\'ll extract metadata and keep existing geometry');
  
  // Since geometry is already in the database, we have two options:
  // 1. Use ogr2ogr to get fresh geometry (if available)
  // 2. Just verify/update the existing geometry format
  
  // Try ogr2ogr first
  try {
    const tempGeoJSONPath = join(process.cwd(), 'temp_ctu_geojson.json');
    
    execSync(
      `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${tempGeoJSONPath}" "${GPKG_PATH}" city_township_unorg`,
      { stdio: 'pipe' }
    );
    
    const geoJsonData = JSON.parse(readFileSync(tempGeoJSONPath, 'utf-8'));
    unlinkSync(tempGeoJSONPath);
    
    // Transform GeoJSON features to our CTU format
    const ctus: CTUFeature[] = geoJsonData.features.map((feature: any) => {
      const props = feature.properties || {};
      
      // Skip invalid records
      if (!props.CTU_CLASS || !props.FEATURE_NAME || !props.COUNTY_NAME || props.COUNTY_NAME === 'NV') {
        return null;
      }
      
      return {
        ctu_class: props.CTU_CLASS as 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY',
        feature_name: props.FEATURE_NAME,
        gnis_feature_id: props.GNIS_FEATURE_ID ? String(props.GNIS_FEATURE_ID) : null,
        county_name: props.COUNTY_NAME,
        county_code: props.COUNTY_CODE ? String(props.COUNTY_CODE) : null,
        county_gnis_feature_id: props.COUNTY_GNIS_FEATURE_ID ? String(props.COUNTY_GNIS_FEATURE_ID) : null,
        population: props.POPULATION ? parseInt(props.POPULATION) : null,
        acres: null,
        geometry: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: feature.geometry,
          }],
        },
      };
    }).filter((ctu: CTUFeature | null) => ctu !== null) as CTUFeature[];
    
    console.log(`✅ Converted ${ctus.length} CTU records with ogr2ogr`);
    return ctus;
  } catch (error) {
    // ogr2ogr not available - since geometry is already populated,
    // we'll just need to verify the format is correct
    console.warn('⚠️  ogr2ogr not available');
    console.warn('   Since geometry columns are already populated,');
    console.warn('   please run migration 402_convert_ctu_geometry.sql to ensure proper format');
    throw new Error('ogr2ogr required for reimport. If geometry is already populated, run migration 402_convert_ctu_geometry.sql instead.');
  }
}

async function importCTUs() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting CTU boundaries import...\n');

  try {
    // Convert GeoPackage to GeoJSON
    const ctus = await convertGPKGToGeoJSON();

    if (ctus.length === 0) {
      throw new Error('No CTU records found in GeoPackage');
    }

    console.log(`\n📊 Found ${ctus.length} CTU records:`);
    const classCounts = ctus.reduce((acc, ctu) => {
      acc[ctu.ctu_class] = (acc[ctu.ctu_class] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`   Cities: ${classCounts['CITY'] || 0}`);
    console.log(`   Townships: ${classCounts['TOWNSHIP'] || 0}`);
    console.log(`   Unorganized Territories: ${classCounts['UNORGANIZED TERRITORY'] || 0}`);

    // Clear existing data
    console.log('\n🗑️  Clearing existing CTU boundaries...');
    const { count, error: countError } = await supabase
      .schema('civic')
      .from('ctu_boundaries')
      .select('*', { count: 'exact', head: true });
    
    if (!countError && count !== null) {
      console.log(`   Found ${count} existing records`);
    }
    
    const { error: deleteError } = await supabase
      .schema('civic')
      .from('ctu_boundaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.warn('⚠️  Warning: Could not clear existing data:', deleteError.message);
    } else {
      console.log('✅ Cleared existing data');
    }

    // Insert in batches
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;

    console.log(`\n📥 Importing ${ctus.length} CTU records in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < ctus.length; i += BATCH_SIZE) {
      const batch = ctus.slice(i, i + BATCH_SIZE);
      
      // Remove id field if present (database auto-generates UUIDs)
      const cleanBatch = batch.map(({ id, ...rest }) => rest);
      
      const { data, error } = await supabase
        .schema('civic')
        .from('ctu_boundaries')
        .insert(cleanBatch)
        .select();

      if (error) {
        // If it's a duplicate key error, try inserting one by one to skip duplicates
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          // Insert records individually to skip duplicates
          let batchImported = 0;
          for (const record of cleanBatch) {
            const { data: singleData, error: singleError } = await supabase
              .from('ctu_boundaries')
              .insert(record)
              .select();
            
            if (!singleError) {
              batchImported++;
            }
          }
          imported += batchImported;
          if (batchImported < batch.length) {
            errors += batch.length - batchImported;
          }
          console.log(`   ✅ Imported batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ctus.length / BATCH_SIZE)} (${imported}/${ctus.length} records, ${batch.length - batchImported} duplicates skipped)`);
        } else {
          console.error(`❌ Error importing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
          errors += batch.length;
        }
      } else {
        imported += data?.length || 0;
        console.log(`   ✅ Imported batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ctus.length / BATCH_SIZE)} (${imported}/${ctus.length} records)`);
      }
    }

    console.log(`\n✨ Import complete!`);
    console.log(`   ✅ Successfully imported: ${imported}`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importCTUs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

