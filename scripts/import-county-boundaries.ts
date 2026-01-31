#!/usr/bin/env tsx
/**
 * Import county boundaries from shapefile into layers.counties table
 * 
 * Usage: 
 *   npx tsx scripts/import-county-boundaries.ts
 * 
 * Requires environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 
 * These can be set in .env.local or passed inline:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-county-boundaries.ts
 * 
 * Note: This script uses ogr2ogr to convert shapefile to GeoJSON. Make sure GDAL is installed:
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

// Use main shapefile (has CTY_NAME field confirmed by inspection)
const SHP_PATH = join(process.cwd(), 'minnesota_gov', 'GIS', 'County', 'County Boundaries', 'shp_bdry_counties_in_minnesota', 'mn_county_boundaries.shp');
const TEMP_GEOJSON_PATH = join(process.cwd(), 'temp_county_boundaries.json');


interface CountyBoundaryFeature {
  county_name: string;
  county_code?: string;
  county_gnis_feature_id?: string;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

/**
 * Convert shapefile to GeoJSON using ogr2ogr
 */
function convertShapefileToGeoJSON(): CountyBoundaryFeature[] {
  console.log('🔄 Converting shapefile to GeoJSON...');
  
  if (!existsSync(SHP_PATH)) {
    throw new Error(`Shapefile not found: ${SHP_PATH}`);
  }
  
  try {
    // Convert to GeoJSON
    execSync(
      `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${TEMP_GEOJSON_PATH}" "${SHP_PATH}"`,
      { stdio: 'pipe' }
    );
    
    const geoJsonData = JSON.parse(readFileSync(TEMP_GEOJSON_PATH, 'utf-8'));
    unlinkSync(TEMP_GEOJSON_PATH);
    
    // Log first feature's properties to debug field names
    if (geoJsonData.features && geoJsonData.features.length > 0) {
      const firstFeature = geoJsonData.features[0];
      console.log(`\n📋 Sample feature properties:`, Object.keys(firstFeature.properties || {}));
      if (firstFeature.properties) {
        console.log(`   Property values:`, Object.entries(firstFeature.properties).slice(0, 10));
      }
    }
    
    // Transform GeoJSON features to our county format
    const counties: CountyBoundaryFeature[] = geoJsonData.features.map((feature: any) => {
      const props = feature.properties || {};
      
      // Try different possible field names for county name
      // According to metadata, the field is CTY_NAME
      const countyName = props.CTY_NAME ||
                         props.cty_name ||
                         props.COUNTY_NAME || 
                         props.county_name ||
                         props.COUNTY || 
                         props.county ||
                         props.NAME || 
                         props.name ||
                         props.COUNTY_NAM || 
                         props.CO_NAME ||
                         props.County ||
                         props.CountyName ||
                         props.COUNTYNAME ||
                         '';
      
      if (!countyName) {
        // Log the actual properties for debugging
        console.warn(`⚠️  Warning: Feature missing county name. Available properties:`, Object.keys(props));
        return null;
      }
      
      return {
        county_name: countyName.trim(),
        county_code: props.CTY_FIPS || 
                     props.CTY_FIPS_CODE ||
                     props.COUNTY_CODE || 
                     props.CO_CODE || 
                     props.county_code || 
                     props.FIPS || 
                     null,
        county_gnis_feature_id: props.COUNTY_GNIS_FEATURE_ID || 
                                props.GNIS_ID || 
                                props.gnis_feature_id || 
                                null,
        geometry: feature.geometry,
      };
    }).filter((county: CountyBoundaryFeature | null) => county !== null) as CountyBoundaryFeature[];
    
    console.log(`✅ Converted ${counties.length} county boundaries`);
    return counties;
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

async function importCountyBoundaries() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting county boundaries import...\n');

  try {
    // Convert shapefile to GeoJSON
    const counties = convertShapefileToGeoJSON();

    if (counties.length === 0) {
      throw new Error('No county boundaries found in shapefile');
    }

    console.log(`\n📊 Found ${counties.length} county boundary features`);

    // Group features by county name (some counties may have multiple features/multipart polygons)
    console.log('🔄 Grouping features by county name...');
    const countyGroups = new Map<string, {
      county_name: string;
      county_code?: string;
      county_gnis_feature_id?: string;
      geometries: any[];
    }>();

    counties.forEach(county => {
      const normalizedName = county.county_name.toLowerCase().trim();
      if (!countyGroups.has(normalizedName)) {
        countyGroups.set(normalizedName, {
          county_name: county.county_name,
          county_code: county.county_code,
          county_gnis_feature_id: county.county_gnis_feature_id,
          geometries: [],
        });
      }
      const group = countyGroups.get(normalizedName)!;
      group.geometries.push(county.geometry);
      // Use the first non-null value for code and GNIS ID
      if (!group.county_code && county.county_code) {
        group.county_code = county.county_code;
      }
      if (!group.county_gnis_feature_id && county.county_gnis_feature_id) {
        group.county_gnis_feature_id = county.county_gnis_feature_id;
      }
    });

    const uniqueCounties = Array.from(countyGroups.values());
    console.log(`✅ Grouped into ${uniqueCounties.length} unique counties`);

    // Get existing counties from database for linking
    const { data: existingCounties, error: fetchError } = await supabase
      .schema('atlas')
      .from('counties')
      .select('id, name');

    if (fetchError) {
      console.warn(`⚠️  Warning: Could not fetch atlas.counties: ${fetchError.message}`);
      console.warn('   County boundaries will be imported without county_id links');
    }

    // Create a map of county names (normalized for matching)
    const countyMap = new Map<string, string>();
    if (existingCounties) {
      existingCounties.forEach(county => {
        const normalizedName = county.name.toLowerCase().trim();
        countyMap.set(normalizedName, county.id);
      });
    }

    // Clear existing data
    console.log('\n🗑️  Clearing existing county boundaries...');
    const { error: deleteError } = await supabase
      .schema('civic')
      .from('county_boundaries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.warn('⚠️  Warning: Could not clear existing data:', deleteError.message);
    } else {
      console.log('✅ Cleared existing data');
    }

    // Insert in batches
    const BATCH_SIZE = 50;
    let imported = 0;
    let errors = 0;

    console.log(`\n📥 Importing ${uniqueCounties.length} county boundaries in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < uniqueCounties.length; i += BATCH_SIZE) {
      const batch = uniqueCounties.slice(i, i + BATCH_SIZE);
      
      const insertData = batch.map(countyGroup => {
        const normalizedName = countyGroup.county_name.toLowerCase().trim();
        const countyId = countyMap.get(normalizedName) || null;

        // Create FeatureCollection with all features for this county
        const featureCollection = {
          type: 'FeatureCollection',
          features: countyGroup.geometries.map((geometry, idx) => ({
            type: 'Feature',
            properties: {
              county_name: countyGroup.county_name,
              feature_index: idx,
            },
            geometry: geometry,
          })),
        };

        return {
          county_name: countyGroup.county_name,
          county_code: countyGroup.county_code || null,
          county_gnis_feature_id: countyGroup.county_gnis_feature_id || null,
          county_id: countyId,
          description: `Boundary for ${countyGroup.county_name} County, Minnesota`,
          publisher: 'Minnesota Department of Natural Resources',
          geometry: featureCollection,
        };
      });

      const { data, error } = await supabase
        .schema('layers')
        .from('counties')
        .insert(insertData)
        .select();

      if (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        errors += batch.length;
      } else {
        imported += data?.length || 0;
        console.log(`   ✅ Imported batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueCounties.length / BATCH_SIZE)} (${imported}/${uniqueCounties.length} records)`);
      }
    }

    console.log(`\n✨ Import complete!`);
    console.log(`   ✅ Successfully imported: ${imported}`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }

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
importCountyBoundaries().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

