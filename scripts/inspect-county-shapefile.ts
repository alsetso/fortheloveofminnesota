#!/usr/bin/env tsx
/**
 * Inspect county boundaries shapefile to see what fields are available
 */

import { execSync } from 'child_process';
import { join } from 'path';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';

const SHP_PATH = join(process.cwd(), 'minnesota_gov', 'GIS', 'County', 'County Boundaries', 'shp_bdry_counties_in_minnesota', 'mn_county_boundaries.shp');
const TEMP_GEOJSON_PATH = join(process.cwd(), 'temp_county_inspect.json');

try {
  // Convert to GeoJSON
  execSync(
    `ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${TEMP_GEOJSON_PATH}" "${SHP_PATH}"`,
    { stdio: 'pipe' }
  );
  
  const geoJsonData = JSON.parse(readFileSync(TEMP_GEOJSON_PATH, 'utf-8'));
  unlinkSync(TEMP_GEOJSON_PATH);
  
  console.log(`\n📊 Total features: ${geoJsonData.features?.length || 0}\n`);
  
  if (geoJsonData.features && geoJsonData.features.length > 0) {
    const firstFeature = geoJsonData.features[0];
    console.log('🔍 First feature properties:');
    console.log(JSON.stringify(firstFeature.properties, null, 2));
    
    console.log('\n📋 All property keys from first 5 features:');
    const allKeys = new Set<string>();
    geoJsonData.features.slice(0, 5).forEach((f: any) => {
      Object.keys(f.properties || {}).forEach(key => allKeys.add(key));
    });
    console.log(Array.from(allKeys).sort());
    
    console.log('\n📝 Sample values from first feature:');
    Object.entries(firstFeature.properties || {}).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
} catch (error: any) {
  console.error('Error:', error.message);
  if (existsSync(TEMP_GEOJSON_PATH)) {
    unlinkSync(TEMP_GEOJSON_PATH);
  }
}

