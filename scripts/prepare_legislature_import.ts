import * as fs from 'fs';
import * as path from 'path';

interface LegislaturePerson {
  name: string;
  party: string;
  district: string;
  phone: string;
  email: string | null;
  building_id: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

function escapeSqlString(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function prepareData() {
  // Read and parse Senate data
  const senatePath = path.join(__dirname, '../minnesota_gov/peoples/senate.md');
  const senateContent = fs.readFileSync(senatePath, 'utf8');
  const senateJson = senateContent.replace(/^#.*\n\n/, '');
  const senate: LegislaturePerson[] = JSON.parse(senateJson);

  // Read and parse House data
  const housePath = path.join(__dirname, '../minnesota_gov/peoples/house.md');
  const houseContent = fs.readFileSync(housePath, 'utf8');
  const houseJson = houseContent.replace(/^#.*\n\n/, '');
  const house: LegislaturePerson[] = JSON.parse(houseJson);

  console.log(`✓ Senate records: ${senate.length}`);
  console.log(`✓ House records: ${house.length}`);
  console.log(`✓ Total records: ${senate.length + house.length}`);

  // Validate counts
  if (senate.length !== 67) {
    console.warn(`⚠ Warning: Expected 67 senate records, found ${senate.length}`);
  }
  if (house.length !== 134) {
    console.warn(`⚠ Warning: Expected 134 house records, found ${house.length}`);
  }

  // Generate SQL INSERT statements
  const sqlStatements: string[] = [];
  
  // Process Senate
  for (const person of senate) {
    const slug = generateSlug(person.name);
    const district = `SD${person.district.padStart(2, '0')}`;
    const title = 'Senate';
    
    sqlStatements.push(
      `INSERT INTO civic.people (name, slug, party, district, phone, email, building_id, title) VALUES (` +
      `${escapeSqlString(person.name)}, ` +
      `${escapeSqlString(slug)}, ` +
      `${escapeSqlString(person.party)}, ` +
      `${escapeSqlString(district)}, ` +
      `${escapeSqlString(person.phone)}, ` +
      `${escapeSqlString(person.email)}, ` +
      `${escapeSqlString(person.building_id)}, ` +
      `${escapeSqlString(title)}` +
      `);`
    );
  }

  // Process House
  for (const person of house) {
    const slug = generateSlug(person.name);
    const district = `HD${person.district}`;
    const title = 'House of Representatives';
    
    sqlStatements.push(
      `INSERT INTO civic.people (name, slug, party, district, phone, email, building_id, title) VALUES (` +
      `${escapeSqlString(person.name)}, ` +
      `${escapeSqlString(slug)}, ` +
      `${escapeSqlString(person.party)}, ` +
      `${escapeSqlString(district)}, ` +
      `${escapeSqlString(person.phone)}, ` +
      `${escapeSqlString(person.email)}, ` +
      `${escapeSqlString(person.building_id)}, ` +
      `${escapeSqlString(title)}` +
      `);`
    );
  }

  // Write SQL file
  const outputPath = path.join(__dirname, '../supabase/migrations/400_import_legislature_people.sql');
  const sqlContent = `-- Import Minnesota Legislature (Senate + House) into civic.people
-- Generated: ${new Date().toISOString()}
-- Senate records: ${senate.length}
-- House records: ${house.length}
-- Total: ${senate.length + house.length}

-- ============================================================================
-- Import Senate (67 records)
-- ============================================================================

${sqlStatements.slice(0, senate.length).join('\n\n')}

-- ============================================================================
-- Import House (134 records)
-- ============================================================================

${sqlStatements.slice(senate.length).join('\n\n')}

-- ============================================================================
-- Verify counts
-- ============================================================================

-- SELECT COUNT(*) FROM civic.people WHERE district LIKE 'SD%'; -- Should be 67
-- SELECT COUNT(*) FROM civic.people WHERE district LIKE 'HD%'; -- Should be 134
`;

  fs.writeFileSync(outputPath, sqlContent, 'utf8');
  console.log(`\n✓ SQL migration file created: ${outputPath}`);
  console.log(`✓ Total SQL statements: ${sqlStatements.length}`);

  // Also create a JSON file for reference
  const jsonOutputPath = path.join(__dirname, '../minnesota_gov/peoples/legislature_combined.json');
  const combined = {
    senate: senate.map(p => ({ ...p, chamber: 'senate', district: `SD${p.district.padStart(2, '0')}` })),
    house: house.map(p => ({ ...p, chamber: 'house', district: `HD${p.district}` })),
    summary: {
      senate_count: senate.length,
      house_count: house.length,
      total: senate.length + house.length,
      generated_at: new Date().toISOString()
    }
  };
  fs.writeFileSync(jsonOutputPath, JSON.stringify(combined, null, 2), 'utf8');
  console.log(`✓ JSON reference file created: ${jsonOutputPath}`);
}

prepareData();

