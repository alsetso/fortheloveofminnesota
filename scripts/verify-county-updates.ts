/**
 * Verification script to check which counties will be updated
 * Run with: npx tsx scripts/verify-county-updates.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const countiesToUpdate = [
  { name: 'Hennepin County', url: 'https://www.hennepin.us/' },
  { name: 'Ramsey County', url: 'https://www.ramseycounty.us/' },
  { name: 'Dakota County', url: 'https://www.co.dakota.mn.us/Pages/default.aspx' },
  { name: 'Anoka County', url: 'https://www.anokacountymn.gov/' },
  { name: 'Washington County', url: 'https://www.washingtoncountymn.gov/' },
  { name: 'Scott County', url: 'https://www.scottcountymn.gov/' },
  { name: 'Wright County', url: 'https://www.wrightcountymn.gov/' },
  { name: 'Carver County', url: 'https://www.carvercountymn.gov/' },
  { name: 'Sherburne County', url: 'https://www.sherburnecounty-mn.gov/' },
  { name: 'St. Louis County', url: 'https://www.stlouiscountymn.gov/' },
  { name: 'Chisago County', url: 'https://www.chisagocountymn.gov/' },
  { name: 'Isanti County', url: 'https://www.co.isanti.mn.us/' },
  { name: 'Rice County', url: 'https://www.co.rice.mn.us/' },
  { name: 'Goodhue County', url: 'https://goodhuecountymn.gov/' },
  { name: 'Benton County', url: 'https://www.co.benton.mn.us/' },
  { name: 'Stearns County', url: 'https://www.co.stearns.mn.us/' },
  { name: 'Olmsted County', url: 'https://www.olmstedcounty.gov/' },
  { name: 'Clay County', url: 'https://www.claycountymn.gov/' },
  { name: 'Sibley County', url: 'https://www.co.sibley.mn.us/' },
  { name: 'Dodge County', url: 'https://www.co.dodge.mn.us/' },
  { name: 'Morrison County', url: 'https://www.co.morrison.mn.us/' },
];

async function verifyCounties() {
  console.log('Verifying counties to be updated...\n');

  for (const county of countiesToUpdate) {
    // Try exact match first
    const { data, error } = await supabase
      .from('counties')
      .select('id, name, website_url, favorite')
      .eq('name', county.name)
      .single();

    // If not found, try case-insensitive search
    if (error || !data) {
      const { data: searchData } = await supabase
        .from('counties')
        .select('id, name, website_url, favorite')
        .ilike('name', `%${county.name.replace(' County', '')}%`)
        .limit(1)
        .single();

      data = searchData || null;
    }

    if (data) {
      console.log(`✓ ${data.name} (ID: ${data.id})`);
      console.log(`  Current website_url: ${data.website_url || 'NULL'}`);
      console.log(`  Current favorite: ${data.favorite}`);
      console.log(`  Will update to: ${county.url}`);
      console.log(`  Will set favorite: true\n`);
    } else {
      console.log(`✗ NOT FOUND: ${county.name}\n`);
    }
  }

  console.log('\nVerification complete. Review the migration file:');
  console.log('supabase/migrations/172_update_county_websites_and_favorites.sql');
}

verifyCounties().catch(console.error);








