#!/usr/bin/env tsx
/**
 * Import state boundary from GeoPackage into civic.state_boundary table
 * 
 * Usage: 
 *   npx tsx scripts/import-state-boundary.ts
 * 
 * Requires environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 
 * These can be set in .env.local or passed inline:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-state-boundary.ts
 * 
 * Note: This script uses ogr2ogr to convert GeoPackage to GeoJSON. Make sure GDAL is installed:
 *   macOS: brew install gdal
 *   Linux: apt-get install gdal-bin
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { join } from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const GPKG_PATH = join(process.cwd(), 'minnesota_gov', 'GIS', 'State', 'State Boundary', 'gpkg_bdry_state_of_minnesota', 'bdry_state_of_minnesota.gpkg');
const TEMP_GEOJSON_PATH = join(process.cwd(), 'temp_state_boundary.json');

interface StateBoundaryFeature {
  name: string;
  description?: string;
  publisher?: string;
  source_date?: string;
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
 * Convert GeoPackage to GeoJSON using ogr2ogr
 */
function convertGPKGToGeoJSON(): StateBoundaryFeature {
  console.log('🔄 Converting GeoPackage to GeoJSON...');
  
  try {
    // Use ogr2ogr to convert GeoPackage to GeoJSON
    // First, list tables to find the correct layer name
    const listTablesCmd = `ogrinfo -ro "${GPKG_PATH}"`;
    const tableList = execSync(listTablesCmd, { encoding: 'utf-8' });
    
    // Extract table name (usually the first non-system table)
    const tableMatch = tableList.match(/^\d+:\s+(\w+)\s+\(/m);
    const tableName = tableMatch ? tableMatch[1] : null;
    
    if (!tableName) {
      throw new Error('Could not determine table name from GeoPackage');
    }
    
    console.log(`   Found table: ${tableName}`);
    
    // Convert to GeoJSON
    execSync(
      `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${TEMP_GEOJSON_PATH}" "${GPKG_PATH}" "${tableName}"`,
      { stdio: 'pipe' }
    );
    
    const geoJsonData = JSON.parse(readFileSync(TEMP_GEOJSON_PATH, 'utf-8'));
    unlinkSync(TEMP_GEOJSON_PATH);
    
    // Extract metadata from first feature if available
    const firstFeature = geoJsonData.features?.[0];
    const props = firstFeature?.properties || {};
    
    const stateBoundary: StateBoundaryFeature = {
      name: 'Minnesota State Boundary',
      description: props.DESCRIPTION || props.description || 'Standard Minnesota State Boundary dataset',
      publisher: props.PUBLISHER || props.publisher || 'Minnesota Department of Natural Resources',
      source_date: props.SOURCE_DATE || props.source_date || undefined,
      geometry: geoJsonData,
    };
    
    console.log(`✅ Converted state boundary (${geoJsonData.features?.length || 0} features)`);
    return stateBoundary;
  } catch (error: any) {
    if (existsSync(TEMP_GEOJSON_PATH)) {
      unlinkSync(TEMP_GEOJSON_PATH);
    }
    
    if (error.message?.includes('ogr2ogr') || error.message?.includes('command not found')) {
      throw new Error('ogr2ogr is required. Install with: brew install gdal (macOS) or apt-get install gdal-bin (Linux)');
    }
    throw error;
  }
}

async function importStateBoundary() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting state boundary import...\n');

  try {
    // Convert GeoPackage to GeoJSON
    const stateBoundary = convertGPKGToGeoJSON();

    if (!stateBoundary.geometry.features || stateBoundary.geometry.features.length === 0) {
      throw new Error('No features found in state boundary GeoPackage');
    }

    console.log(`\n📊 State boundary data:`);
    console.log(`   Name: ${stateBoundary.name}`);
    console.log(`   Publisher: ${stateBoundary.publisher || 'N/A'}`);
    console.log(`   Features: ${stateBoundary.geometry.features.length}`);

    // Clear existing data
    console.log('\n🗑️  Clearing existing state boundary...');
    const { error: deleteError } = await supabase
      .schema('civic')
      .from('state_boundary')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.warn('⚠️  Warning: Could not clear existing data:', deleteError.message);
    } else {
      console.log('✅ Cleared existing data');
    }

    // Insert new record
    const insertData = {
      name: stateBoundary.name,
      description: stateBoundary.description || null,
      publisher: stateBoundary.publisher || null,
      source_date: stateBoundary.source_date || null,
      geometry: stateBoundary.geometry,
    };

    console.log('\n➕ Inserting state boundary...');
    const { error: insertError } = await supabase
      .schema('civic')
      .from('state_boundary')
      .insert(insertData);

    if (insertError) {
      throw new Error(`Failed to insert state boundary: ${insertError.message}`);
    }
    console.log('✅ Inserted state boundary');

    // Calculate approximate size
    const sizeKB = (JSON.stringify(stateBoundary.geometry).length / 1024).toFixed(2);
    console.log(`\n💾 Geometry size: ${sizeKB} KB`);

    console.log('\n✨ Import complete!');

  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    if (error.message.includes('ogr2ogr')) {
      console.error('\n💡 To install ogr2ogr:');
      console.error('   macOS: brew install gdal');
      console.error('   Linux: apt-get install gdal-bin');
    }
    process.exit(1);
  }
}

// Run import
importStateBoundary().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

