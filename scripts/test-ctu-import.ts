#!/usr/bin/env tsx
/**
 * Test CTU boundaries import with a single city and township
 * Verifies geometry conversion works correctly before full import
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

async function testImport() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing CTU boundaries import with 1 city and 1 township...\n');

  try {
    // Try using ogr2ogr to extract just 2 records
    console.log('🔄 Attempting to extract test records with ogr2ogr...');
    
    let testRecords: CTUFeature[] = [];
    
    try {
      const tempGeoJSONPath = join(process.cwd(), 'temp_ctu_test_geojson.json');
      
      // Extract all records first, then filter
      execSync(
        `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${tempGeoJSONPath}" "${GPKG_PATH}" city_township_unorg`,
        { stdio: 'pipe' }
      );
      
      const geoJsonData = JSON.parse(readFileSync(tempGeoJSONPath, 'utf-8'));
      unlinkSync(tempGeoJSONPath);
      
      // Find 1 city and 1 township
      let cityFound = false;
      let townshipFound = false;
      
      for (const feature of geoJsonData.features) {
        const props = feature.properties || {};
        
        if (!props.CTU_CLASS || !props.FEATURE_NAME || !props.COUNTY_NAME || props.COUNTY_NAME === 'NV') {
          continue;
        }
        
        if (!cityFound && props.CTU_CLASS === 'CITY') {
          testRecords.push({
            ctu_class: 'CITY',
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
          });
          cityFound = true;
          console.log(`   ✅ Found city: ${props.FEATURE_NAME}`);
        }
        
        if (!townshipFound && props.CTU_CLASS === 'TOWNSHIP') {
          testRecords.push({
            ctu_class: 'TOWNSHIP',
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
          });
          townshipFound = true;
          console.log(`   ✅ Found township: ${props.FEATURE_NAME}`);
        }
        
        if (cityFound && townshipFound) {
          break;
        }
      }
      
      if (!cityFound || !townshipFound) {
        throw new Error(`Could not find test records. City: ${cityFound}, Township: ${townshipFound}`);
      }
      
      console.log(`✅ Extracted ${testRecords.length} test records with geometry\n`);
    } catch (error: any) {
      if (error.message && error.message.includes('ogr2ogr')) {
        console.error('❌ ogr2ogr not available');
        throw new Error('ogr2ogr is required for geometry conversion. Install with: brew install gdal');
      }
      throw error;
    }

    // Verify geometry structure
    console.log('🔍 Verifying geometry structure...');
    for (const record of testRecords) {
      const geom = record.geometry;
      if (!geom || geom.type !== 'FeatureCollection') {
        throw new Error(`Invalid geometry type for ${record.feature_name}: ${geom?.type}`);
      }
      
      if (!geom.features || geom.features.length === 0) {
        throw new Error(`No features in geometry for ${record.feature_name}`);
      }
      
      const feature = geom.features[0];
      if (!feature.geometry || !feature.geometry.coordinates) {
        throw new Error(`No coordinates in geometry for ${record.feature_name}`);
      }
      
      const coords = feature.geometry.coordinates;
      if (Array.isArray(coords) && coords.length === 0) {
        throw new Error(`Empty coordinates for ${record.feature_name}`);
      }
      
      console.log(`   ✅ ${record.feature_name} (${record.ctu_class}): ${feature.geometry.type} with ${Array.isArray(coords[0]) ? coords.length : 'N/A'} coordinate rings`);
    }

    // Clear existing test data (if any)
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

    // Import test records
    console.log('\n📥 Importing test records...');
    
    // Remove any id field if present
    const cleanRecords = testRecords.map(({ ...rest }) => rest);
    
    const { data, error } = await supabase
      .schema('civic')
      .from('ctu_boundaries')
      .insert(cleanRecords)
      .select();

    if (error) {
      console.error('❌ Error importing test records:', error);
      throw error;
    }

    console.log(`✅ Successfully imported ${data?.length || 0} test records\n`);

    // Verify imported data
    console.log('🔍 Verifying imported data...');
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
          console.log(`   ✅ ${record.feature_name}: Geometry ${hasCoords ? 'has coordinates' : 'missing coordinates'}`);
        } else {
          console.log(`   ⚠️  ${record.feature_name}: Invalid geometry structure`);
        }
      }
    }

    console.log('\n✨ Test import complete!');
    console.log('   If geometry looks good, you can proceed with full import using:');
    console.log('   npx tsx scripts/import-ctu-boundaries.ts');

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

