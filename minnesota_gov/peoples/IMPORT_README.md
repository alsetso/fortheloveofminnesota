# Minnesota Legislature Data Import

## Summary

**Status**: ✅ Ready for import

- **Senate records**: 67
- **House records**: 134
- **Total records**: 201

## Files

### Source Data
- `senate.md` - 67 Senate members (JSON format)
- `house.md` - 134 House members (JSON format)

### Generated Files
- `legislature_combined.json` - Combined JSON reference file
- `../supabase/migrations/400_import_legislature_people.sql` - SQL migration file

## Data Mapping

| Source Field | Target Field | Notes |
|-------------|--------------|-------|
| `name` | `name` | Full name |
| `party` | `party` | R, DFL, or null |
| `district` | `district` | Formatted as `SD##` (Senate) or `HD##A/B` (House) |
| `phone` | `phone` | Phone number |
| `email` | `email` | Email address (nullable) |
| `building_id` | `building_id` | UUID reference to civic.buildings |
| - | `slug` | Auto-generated from name (URL-friendly) |
| - | `title` | "Senate" for senators, "House of Representatives" for representatives |

## District Format

- **Senate**: `SD01`, `SD02`, ..., `SD67` (zero-padded)
- **House**: `HD01A`, `HD01B`, `HD02A`, ..., `HD67B` (preserves A/B suffix)

## Building IDs

- **Senate**: All senators use building `79c1d888-82e5-4210-93d8-ca9a71258bab`
- **House**: All representatives use building `ae0605df-bfd9-4ab3-8eb6-30d539adf562`

## Import Instructions

1. **First, add the title column** (if not already applied):
   ```bash
   # Migration 399 adds the title column
   # This should run before migration 400
   ```

2. Review the SQL migration file:
   ```bash
   cat supabase/migrations/400_import_legislature_people.sql
   ```

3. Run the migrations:
   ```bash
   # Using Supabase CLI (will run migrations in order)
   supabase db push
   
   # Or manually execute the SQL files in order:
   # 1. 399_add_title_to_people.sql
   # 2. 400_import_legislature_people.sql
   ```

4. Verify the import:
   ```sql
   -- Check counts
   SELECT COUNT(*) FROM civic.people WHERE district LIKE 'SD%'; -- Should be 67
   SELECT COUNT(*) FROM civic.people WHERE district LIKE 'HD%'; -- Should be 134
   
   -- Check titles
   SELECT title, COUNT(*) 
   FROM civic.people 
   WHERE district LIKE 'SD%' OR district LIKE 'HD%'
   GROUP BY title;
   -- Should show: Senate (67), House of Representatives (134)
   
   -- Check for duplicates
   SELECT slug, COUNT(*) 
   FROM civic.people 
   WHERE district LIKE 'SD%' OR district LIKE 'HD%'
   GROUP BY slug 
   HAVING COUNT(*) > 1;
   
   -- Sample records
   SELECT name, title, district, party, phone, email 
   FROM civic.people 
   WHERE district LIKE 'SD%' 
   ORDER BY district 
   LIMIT 5;
   ```

## Data Quality

- ✅ All 67 Senate records present
- ✅ All 134 House records present
- ✅ All slugs are unique (201 unique slugs)
- ✅ District formatting consistent
- ✅ Null values handled correctly
- ✅ Building IDs validated (UUID format)

## Notes

- Slugs are auto-generated from names using lowercase, hyphenated format
- Special characters in names are removed during slug generation
- Email addresses may be null for some legislators
- All records include phone numbers

