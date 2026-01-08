#!/usr/bin/env tsx
/**
 * Import congressional district GeoJSON files into civic.congressional_districts table
 * 
 * Usage: 
 *   npx tsx scripts/import-congressional-districts.ts
 * 
 * Requires environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 
 * These can be set in .env.local or passed inline:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-congressional-districts.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const DISTRICTS_DIR = join(process.cwd(), 'minnesota_gov', 'Congressional Districts JSON');

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  description?: string;
  title?: string;
  publisher?: string;
  date?: string;
  xy_coordinate_resolution?: number;
  features: Array<{
    type: 'Feature';
    properties: {
      Precinct?: string;
      PrecinctID?: string;
      County?: string;
      CountyID?: string;
      CongDist?: string;
      MNSenDist?: string;
      MNLegDist?: string;
      CtyComDist?: string;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon' | 'GeometryCollection';
      coordinates: any;
    };
  }>;
}

async function importDistricts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Import each district file (cd1.md through cd8.md)
  for (let districtNum = 1; districtNum <= 8; districtNum++) {
    const filename = `cd${districtNum}.md`;
    const filePath = join(DISTRICTS_DIR, filename);

    console.log(`\n📁 Processing ${filename}...`);

    try {
      // Read and parse GeoJSON file
      const fileContent = readFileSync(filePath, 'utf-8');
      const geoJson: GeoJSONFeatureCollection = JSON.parse(fileContent);

      // Extract district number from features (should match filename)
      const districtFromFeatures = geoJson.features[0]?.properties?.CongDist;
      if (districtFromFeatures && parseInt(districtFromFeatures) !== districtNum) {
        console.warn(
          `⚠️  Warning: District number in filename (${districtNum}) doesn't match CongDist in data (${districtFromFeatures})`
        );
      }

      // Prepare data for insertion
      const insertData = {
        district_number: districtNum,
        name: geoJson.name || 'precincts',
        description: geoJson.description || geoJson.title || null,
        publisher: geoJson.publisher || null,
        date: geoJson.date || null,
        xy_coordinate_resolution: geoJson.xy_coordinate_resolution || null,
        geometry: geoJson as any, // Store full FeatureCollection
      };

      // Check if district already exists
      // Access via public view (see migration 355)
      const { data: existing } = await supabase
        .from('congressional_districts')
        .select('id, district_number')
        .eq('district_number', districtNum)
        .single();

      if (existing) {
        console.log(`  ↻ Updating existing district ${districtNum}...`);
        const { error } = await supabase
          .from('congressional_districts')
          .update(insertData)
          .eq('district_number', districtNum);

        if (error) {
          console.error(`  ❌ Error updating district ${districtNum}:`, error.message);
          continue;
        }
        console.log(`  ✅ Updated district ${districtNum}`);
      } else {
        console.log(`  ➕ Inserting new district ${districtNum}...`);
        const { error } = await supabase
          .from('congressional_districts')
          .insert(insertData);

        if (error) {
          console.error(`  ❌ Error inserting district ${districtNum}:`, error.message);
          continue;
        }
        console.log(`  ✅ Inserted district ${districtNum}`);
      }

      // Log statistics
      const featureCount = geoJson.features.length;
      console.log(`  📊 Features: ${featureCount} precincts`);

      // Calculate approximate size
      const sizeKB = (JSON.stringify(geoJson).length / 1024).toFixed(2);
      console.log(`  💾 Size: ${sizeKB} KB`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`  ⚠️  File not found: ${filename} (skipping)`);
        continue;
      }
      console.error(`  ❌ Error processing ${filename}:`, error.message);
      if (error.message.includes('JSON')) {
        console.error(`  💡 Make sure the file contains valid JSON`);
      }
    }
  }

  console.log('\n✨ Import complete!');
  
  // Verify all districts were imported
  const { data: districts, error } = await supabase
    .from('congressional_districts')
    .select('district_number, name')
    .order('district_number');

  if (error) {
    console.error('❌ Error verifying import:', error.message);
    return;
  }

  console.log('\n📋 Imported districts:');
  districts?.forEach((d) => {
    console.log(`  District ${d.district_number}: ${d.name}`);
  });
}

// Run import
importDistricts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

