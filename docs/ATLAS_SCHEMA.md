# Atlas Schema Overview

The `atlas` schema contains geographic reference data for Minnesota: cities, counties, and points of interest (POI).

## Core Tables

### `atlas.cities`
Reference table for Minnesota cities.

**Columns:**
- `id` (UUID) - Primary key
- `name` (TEXT) - City name (unique)
- `slug` (TEXT) - URL-friendly identifier
- `population` (INTEGER) - City population
- `county_id` (UUID) - Foreign key to `atlas.counties(id)`
- `lat` (NUMERIC) - Latitude
- `lng` (NUMERIC) - Longitude
- `created_at`, `updated_at` (TIMESTAMP)

### `atlas.counties`
Reference table for Minnesota counties.

**Columns:**
- `id` (UUID) - Primary key
- `name` (TEXT) - County name (unique)
- `slug` (TEXT) - URL-friendly identifier
- `lat` (NUMERIC) - Latitude
- `lng` (NUMERIC) - Longitude
- `created_at`, `updated_at` (TIMESTAMP)

## Points of Interest (POI) Tables

All POI tables share a common structure:

**Common Columns:**
- `id` (UUID) - Primary key
- `name` (TEXT) - Entity name
- `slug` (TEXT) - URL-friendly identifier (unique)
- `city_id` (UUID) - Foreign key to `atlas.cities(id)`
- `lat` (NUMERIC) - Latitude
- `lng` (NUMERIC) - Longitude
- `address` (TEXT) - Street address
- `description` (TEXT) - Description
- `meta_title`, `meta_description` (TEXT) - SEO fields
- `website_url`, `phone` (TEXT) - Contact info
- `favorite` (BOOLEAN) - Featured flag
- `view_count` (INTEGER) - View counter
- `created_at`, `updated_at` (TIMESTAMP)

**POI Tables:**
1. `atlas.neighborhoods` 🏘️ - Neighborhoods/districts
2. `atlas.schools` 🎓 - K-12, universities, colleges
   - `school_type`: 'elementary', 'middle', 'high', 'k12', 'university', 'college', 'technical', 'other'
   - `is_public` (BOOLEAN)
   - `district` (TEXT)
   - `enrollment` (INTEGER)
3. `atlas.parks` 🌳 - Parks and recreational areas
   - `county_id` (UUID) - Foreign key to `atlas.counties(id)`
   - `park_type`: 'city', 'county', 'state', 'national', 'regional', 'nature_reserve', 'recreation', 'other'
   - `area_acres` (NUMERIC)
   - `amenities` (JSONB) - Array of amenities
   - `hours` (JSONB) - Operating hours
4. `atlas.lakes` 💧 - Lakes and water bodies
5. `atlas.watertowers` 🗼 - Water towers
6. `atlas.cemeteries` 🪦 - Cemeteries
7. `atlas.golf_courses` ⛳ - Golf courses
   - `course_type`: 'public', 'private', 'semi_private', 'municipal', 'resort', 'other'
   - `holes`: 9, 18, 27, or 36
8. `atlas.hospitals` 🏥 - Hospitals and medical facilities
9. `atlas.airports` ✈️ - Airports
   - `airport_type`: 'commercial', 'general_aviation', 'private', 'military', 'regional', 'international', 'other'
   - `iata_code`, `icao_code` (TEXT)
10. `atlas.churches` ⛪ - Churches and places of worship
    - `denomination` (TEXT)
    - `church_type`: 'catholic', 'protestant', 'orthodox', 'baptist', 'methodist', 'lutheran', 'presbyterian', 'episcopal', 'non_denominational', 'other'
11. `atlas.municipals` 🏛️ - Municipal buildings and facilities
12. `atlas.roads` 🛣️ - Roads and highways
    - `road_type`: 'interstate', 'us_highway', 'state_highway', 'county_road', 'local_road', 'township_road', 'private_road', 'trail', 'bridge', 'tunnel', 'other'
    - `route_number` (TEXT)
    - `direction` (TEXT)
    - `segment_name`, `start_point`, `end_point` (TEXT)
    - `mile_marker` (NUMERIC)
    - **Note:** Roads can have multiple entries (segments) - no unique name constraint
13. `atlas.radio_and_news` 📻 - Radio stations and news outlets

## Unified View

### `atlas.atlas_entities`
Combines all POI tables into a single queryable view.

**Columns:**
- `id` (UUID)
- `name` (TEXT)
- `city_id` (UUID)
- `emoji` (TEXT) - Entity type emoji
- `lat` (NUMERIC)
- `lng` (NUMERIC)
- `table_name` (TEXT) - Source table: 'neighborhoods', 'schools', 'parks', etc.

**Usage:**
```typescript
// Get all entities in a city
const { data } = await supabase
  .from('atlas_entities')
  .select('*')
  .eq('city_id', cityId);

// Filter by entity type
const { data } = await supabase
  .from('atlas_entities')
  .select('*')
  .eq('table_name', 'parks');
```

## Admin Access

### Admin Check
Admin status is determined by `accounts.role = 'admin'` in the `public.accounts` table. The database function `public.is_admin()` checks this automatically.

### RLS Policies

**Read Access (SELECT):**
- **Cities/Counties:** Anyone (authenticated + anon) can read
- **POI Tables:** Anyone can read (public data)

**Write Access (INSERT/UPDATE/DELETE):**
- **All tables:** Only admins can insert, update, or delete
- RLS policies use `public.is_admin()` function

### Fetching as Admin

**1. Check Admin Status First:**
```typescript
// In your auth context or API route
const { data: account } = await supabase
  .from('accounts')
  .select('role')
  .eq('user_id', userId)
  .single();

const isAdmin = account?.role === 'admin';
```

**2. Fetch All Data (Admin Bypass):**
```typescript
// As admin, you can fetch all records
const { data: cities } = await supabase
  .from('cities')
  .select('*');

const { data: parks } = await supabase
  .from('parks')
  .select('*');
```

**3. Insert New Entities (Admin Only):**
```typescript
// Insert new park (requires admin role)
const { data, error } = await supabase
  .from('parks')
  .insert({
    name: 'New Park',
    slug: 'new-park',
    city_id: cityId,
    lat: 44.9778,
    lng: -93.2650,
    park_type: 'city'
  })
  .select()
  .single();
```

**4. Update Entities (Admin Only):**
```typescript
// Update existing entity
const { data, error } = await supabase
  .from('parks')
  .update({ favorite: true })
  .eq('id', parkId)
  .select()
  .single();
```

**5. Delete Entities (Admin Only):**
```typescript
// Delete entity
const { error } = await supabase
  .from('parks')
  .delete()
  .eq('id', parkId);
```

### Helper Function

The database provides a helper function for inserting entities:

```typescript
// Using the helper function (requires admin)
const { data, error } = await supabase.rpc('insert_atlas_entity', {
  p_table_name: 'park', // singular form
  p_data: {
    name: 'New Park',
    slug: 'new-park',
    city_id: cityId,
    // ... other fields
  }
});
```

**Supported table names:** `neighborhood`, `school`, `park`, `lake`, `watertower`, `cemetery`, `golf_course`, `hospital`, `airport`, `church`, `municipal`, `road`, `radio_and_news`

## Common Queries

**Get all parks in a city:**
```typescript
const { data } = await supabase
  .from('parks')
  .select('*')
  .eq('city_id', cityId);
```

**Get all entities with coordinates:**
```typescript
const { data } = await supabase
  .from('atlas_entities')
  .select('*')
  .not('lat', 'is', null)
  .not('lng', 'is', null);
```

**Get featured entities:**
```typescript
const { data } = await supabase
  .from('parks')
  .select('*')
  .eq('favorite', true)
  .order('view_count', { ascending: false });
```

**Get entities by type in a city:**
```typescript
const { data } = await supabase
  .from('atlas_entities')
  .select('*')
  .eq('city_id', cityId)
  .eq('table_name', 'schools');
```


