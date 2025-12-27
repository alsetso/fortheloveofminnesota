-- Move cities, counties, and city_counties tables to atlas schema
-- This cleans up the public schema by organizing geographic reference data

-- ============================================================================
-- STEP 0: Verify tables exist before proceeding
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cities') THEN
    RAISE EXCEPTION 'Table public.cities does not exist. Cannot proceed with migration.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'counties') THEN
    RAISE EXCEPTION 'Table public.counties does not exist. Cannot proceed with migration.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'city_counties') THEN
    RAISE NOTICE 'Table public.city_counties does not exist. Will skip moving it.';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 1: Create atlas schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS atlas;

-- ============================================================================
-- STEP 2: Move counties table first (cities depends on it)
-- ============================================================================

ALTER TABLE public.counties SET SCHEMA atlas;

-- Triggers and indexes move automatically with the table
-- No changes needed

-- ============================================================================
-- STEP 3: Move cities table
-- ============================================================================

ALTER TABLE public.cities SET SCHEMA atlas;

-- Update the foreign key reference to counties
ALTER TABLE atlas.cities 
  DROP CONSTRAINT IF EXISTS cities_county_id_fkey;

ALTER TABLE atlas.cities
  ADD CONSTRAINT cities_county_id_fkey 
  FOREIGN KEY (county_id) 
  REFERENCES atlas.counties(id) 
  ON DELETE SET NULL;

-- Triggers move automatically with the table

-- ============================================================================
-- STEP 4: Move city_counties junction table (if it exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'city_counties') THEN
    ALTER TABLE public.city_counties SET SCHEMA atlas;
    
    -- Update foreign key references
    ALTER TABLE atlas.city_counties 
      DROP CONSTRAINT IF EXISTS city_counties_city_id_fkey,
      DROP CONSTRAINT IF EXISTS city_counties_county_id_fkey;

    ALTER TABLE atlas.city_counties
      ADD CONSTRAINT city_counties_city_id_fkey 
      FOREIGN KEY (city_id) 
      REFERENCES atlas.cities(id) 
      ON DELETE CASCADE;

    ALTER TABLE atlas.city_counties
      ADD CONSTRAINT city_counties_county_id_fkey 
      FOREIGN KEY (county_id) 
      REFERENCES atlas.counties(id) 
      ON DELETE CASCADE;
  ELSE
    RAISE NOTICE 'Table public.city_counties does not exist, skipping move.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not move city_counties table: %', SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 5: Update find_county_by_name function to reference atlas.counties
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_county_by_name(p_county_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_county_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Return NULL if input is empty
  IF p_county_name IS NULL OR TRIM(p_county_name) = '' THEN
    RETURN NULL;
  END IF;

  -- Clean the county name: remove "County" suffix, trim whitespace
  v_clean_name := TRIM(REGEXP_REPLACE(p_county_name, '\s+County$', '', 'i'));

  -- Try exact match first (with "County" suffix)
  SELECT id INTO v_county_id
  FROM atlas.counties
  WHERE name = v_clean_name || ' County'
  LIMIT 1;

  -- If not found, try without "County" suffix
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM atlas.counties
    WHERE name = v_clean_name
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive match
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM atlas.counties
    WHERE LOWER(name) = LOWER(v_clean_name || ' County')
    LIMIT 1;
  END IF;

  -- If still not found, try case-insensitive without "County"
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM atlas.counties
    WHERE LOWER(name) = LOWER(v_clean_name)
    LIMIT 1;
  END IF;

  -- If still not found, try partial match (county name contains the search term)
  IF v_county_id IS NULL THEN
    SELECT id INTO v_county_id
    FROM atlas.counties
    WHERE LOWER(name) LIKE LOWER('%' || v_clean_name || '%')
    LIMIT 1;
  END IF;

  RETURN v_county_id;
END;
$$;

-- ============================================================================
-- STEP 6: Update foreign key references in other tables
-- ============================================================================

-- Update accounts.city_id foreign key
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find and drop existing constraint (constraint name might vary)
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.accounts'::regclass
    AND confrelid = 'atlas.cities'::regclass
    AND contype = 'f'
  LIMIT 1;

  -- If constraint exists but points to old location, drop it
  IF v_constraint_name IS NULL THEN
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.accounts'::regclass
      AND conname LIKE '%city_id%'
      AND contype = 'f'
    LIMIT 1;
  END IF;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END IF;

  -- Add new constraint pointing to atlas.cities
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_city_id_fkey 
    FOREIGN KEY (city_id) 
    REFERENCES atlas.cities(id) 
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint already exists, skipping';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update accounts.city_id foreign key: %', SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 7: Update RLS policies for cities
-- ============================================================================

-- Policies moved with the table, but we need to ensure they exist and are correct
-- Drop existing policies first, then recreate to ensure consistency

DROP POLICY IF EXISTS "Anyone can read cities" ON atlas.cities;
DROP POLICY IF EXISTS "Admins can insert cities" ON atlas.cities;
DROP POLICY IF EXISTS "Admins can update cities" ON atlas.cities;
DROP POLICY IF EXISTS "Admins can delete cities" ON atlas.cities;

-- Recreate policies on atlas.cities
CREATE POLICY "Anyone can read cities"
  ON atlas.cities
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can insert cities"
  ON atlas.cities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update cities"
  ON atlas.cities
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete cities"
  ON atlas.cities
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 8: Update RLS policies for counties
-- ============================================================================

-- Policies moved with the table, but we need to ensure they exist and are correct
-- Drop existing policies first, then recreate to ensure consistency

DROP POLICY IF EXISTS "Anyone can view counties" ON atlas.counties;
DROP POLICY IF EXISTS "Admins can insert counties" ON atlas.counties;
DROP POLICY IF EXISTS "Admins can update counties" ON atlas.counties;
DROP POLICY IF EXISTS "Admins can delete counties" ON atlas.counties;

-- Recreate policies on atlas.counties
CREATE POLICY "Anyone can view counties"
  ON atlas.counties
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can insert counties"
  ON atlas.counties
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update counties"
  ON atlas.counties
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete counties"
  ON atlas.counties
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 9: Update RLS policies for city_counties (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'city_counties') THEN
    -- Policies moved with the table, but we need to ensure they exist and are correct
    -- Drop existing policies first, then recreate to ensure consistency

    DROP POLICY IF EXISTS "Anyone can read city_counties" ON atlas.city_counties;
    DROP POLICY IF EXISTS "Admins can insert city_counties" ON atlas.city_counties;
    DROP POLICY IF EXISTS "Admins can update city_counties" ON atlas.city_counties;
    DROP POLICY IF EXISTS "Admins can delete city_counties" ON atlas.city_counties;

    -- Recreate policies on atlas.city_counties
    CREATE POLICY "Anyone can read city_counties"
      ON atlas.city_counties
      FOR SELECT
      TO authenticated, anon
      USING (true);

    CREATE POLICY "Admins can insert city_counties"
      ON atlas.city_counties
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());

    CREATE POLICY "Admins can update city_counties"
      ON atlas.city_counties
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    CREATE POLICY "Admins can delete city_counties"
      ON atlas.city_counties
      FOR DELETE
      TO authenticated
      USING (public.is_admin());
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create city_counties policies: %', SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 10: Update grants/permissions
-- ============================================================================

-- Grant permissions on atlas schema tables
GRANT SELECT ON atlas.cities TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.cities TO authenticated;

GRANT SELECT ON atlas.counties TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.counties TO authenticated;

-- Grant service_role permissions
GRANT ALL ON atlas.cities TO service_role;
GRANT ALL ON atlas.counties TO service_role;

-- Grant permissions on city_counties if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'city_counties') THEN
    GRANT SELECT ON atlas.city_counties TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON atlas.city_counties TO authenticated;
    GRANT ALL ON atlas.city_counties TO service_role;
  END IF;
END;
$$;

-- ============================================================================
-- STEP 11: Update any views that reference these tables
-- ============================================================================

-- Update v_cities_missing_counties view if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'v_cities_missing_counties'
  ) THEN
    DROP VIEW IF EXISTS public.v_cities_missing_counties;
    
    CREATE OR REPLACE VIEW public.v_cities_missing_counties AS
    SELECT 
      c.id,
      c.name,
      c.county,
      c.county_id,
      CASE 
        WHEN public.find_county_by_name(TRIM(SPLIT_PART(c.county, ',', 1))) IS NULL THEN 'County not found'
        ELSE 'Missing from junction table'
      END AS issue
    FROM atlas.cities c
    WHERE NOT EXISTS (
      SELECT 1 FROM atlas.city_counties cc WHERE cc.city_id = c.id
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update v_cities_missing_counties view: %', SQLERRM;
END;
$$;

-- ============================================================================
-- STEP 12: Update get_city_counties function if it exists
-- ============================================================================

-- Use different dollar-quote tag ($func$) to avoid conflict with DO block
-- CREATE OR REPLACE is safe to run even if function doesn't exist
CREATE OR REPLACE FUNCTION public.get_city_counties(p_city_id UUID)
RETURNS TABLE (
  county_id UUID,
  county_name TEXT,
  is_primary BOOLEAN
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT 
    co.id AS county_id,
    co.name AS county_name,
    cc.is_primary
  FROM atlas.city_counties cc
  JOIN atlas.counties co ON co.id = cc.county_id
  WHERE cc.city_id = p_city_id
  ORDER BY cc.is_primary DESC, co.name;
END;
$func$;

-- ============================================================================
-- STEP 13: Create public views for Supabase client compatibility
-- ============================================================================

-- Supabase PostgREST only exposes the public schema by default
-- Create views in public schema that point to atlas schema tables
-- This allows existing client code to work without changes

CREATE OR REPLACE VIEW public.cities AS
SELECT * FROM atlas.cities;

CREATE OR REPLACE VIEW public.counties AS
SELECT * FROM atlas.counties;

-- Create view for city_counties if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'city_counties') THEN
    CREATE OR REPLACE VIEW public.city_counties AS
    SELECT * FROM atlas.city_counties;
    
    GRANT SELECT ON public.city_counties TO authenticated, anon;
  END IF;
END;
$$;

-- Grant permissions on views
GRANT SELECT ON public.cities TO authenticated, anon;
GRANT SELECT ON public.counties TO authenticated, anon;

-- For write operations, we need to use functions or direct atlas schema access
-- Create functions for insert/update/delete operations

-- Function to insert into cities (via atlas schema)
CREATE OR REPLACE FUNCTION public.insert_city(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO atlas.cities (name, population, county, lat, lng, slug, meta_title, meta_description, website_url, favorite)
  VALUES (
    (data->>'name')::text,
    (data->>'population')::integer,
    (data->>'county')::text,
    (data->>'lat')::numeric,
    (data->>'lng')::numeric,
    (data->>'slug')::text,
    (data->>'meta_title')::text,
    (data->>'meta_description')::text,
    (data->>'website_url')::text,
    COALESCE((data->>'favorite')::boolean, false)
  )
  RETURNING to_jsonb(*) INTO result;
  RETURN result;
END;
$$;

-- Function to update cities
CREATE OR REPLACE FUNCTION public.update_city(id uuid, data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE atlas.cities
  SET
    name = COALESCE((data->>'name')::text, name),
    population = COALESCE((data->>'population')::integer, population),
    county = COALESCE((data->>'county')::text, county),
    lat = (data->>'lat')::numeric,
    lng = (data->>'lng')::numeric,
    slug = (data->>'slug')::text,
    meta_title = (data->>'meta_title')::text,
    meta_description = (data->>'meta_description')::text,
    website_url = (data->>'website_url')::text,
    favorite = COALESCE((data->>'favorite')::boolean, favorite),
    updated_at = NOW()
  WHERE atlas.cities.id = update_city.id
  RETURNING to_jsonb(*) INTO result;
  RETURN result;
END;
$$;

-- Function to delete cities
CREATE OR REPLACE FUNCTION public.delete_city(id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.cities WHERE atlas.cities.id = delete_city.id;
END;
$$;

-- Similar functions for counties
CREATE OR REPLACE FUNCTION public.insert_county(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO atlas.counties (name, population, area_sq_mi, polygon, meta_title, meta_description, website_url, other_urls, favorite)
  VALUES (
    (data->>'name')::text,
    (data->>'population')::integer,
    (data->>'area_sq_mi')::numeric,
    (data->>'polygon')::jsonb,
    (data->>'meta_title')::text,
    (data->>'meta_description')::text,
    (data->>'website_url')::text,
    (data->>'other_urls')::jsonb,
    COALESCE((data->>'favorite')::boolean, false)
  )
  RETURNING to_jsonb(*) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_county(id uuid, data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE atlas.counties
  SET
    name = COALESCE((data->>'name')::text, name),
    population = COALESCE((data->>'population')::integer, population),
    area_sq_mi = COALESCE((data->>'area_sq_mi')::numeric, area_sq_mi),
    polygon = (data->>'polygon')::jsonb,
    meta_title = (data->>'meta_title')::text,
    meta_description = (data->>'meta_description')::text,
    website_url = (data->>'website_url')::text,
    other_urls = (data->>'other_urls')::jsonb,
    favorite = COALESCE((data->>'favorite')::boolean, favorite),
    updated_at = NOW()
  WHERE atlas.counties.id = update_county.id
  RETURNING to_jsonb(*) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_county(id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.counties WHERE atlas.counties.id = delete_county.id;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.insert_city TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_city TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_city TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_county TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_county TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_county TO authenticated;

-- Create INSTEAD OF triggers to make views updatable
-- This allows Supabase client to INSERT/UPDATE/DELETE through the views

CREATE OR REPLACE FUNCTION public.cities_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.cities (
    name, population, county, lat, lng, slug,
    meta_title, meta_description, website_url, favorite,
    view_count, boundary_lines, county_id, created_at, updated_at
  )
  VALUES (
    NEW.name, 
    NEW.population, 
    NEW.county, 
    NEW.lat, 
    NEW.lng, 
    NEW.slug,
    NEW.meta_title, 
    NEW.meta_description, 
    NEW.website_url, 
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0), 
    NEW.boundary_lines, 
    NEW.county_id,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cities_instead_of_insert
INSTEAD OF INSERT ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_insert_trigger();

CREATE OR REPLACE FUNCTION public.cities_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.cities
  SET
    name = COALESCE(NEW.name, OLD.name),
    population = COALESCE(NEW.population, OLD.population),
    county = COALESCE(NEW.county, OLD.county),
    lat = NEW.lat,
    lng = NEW.lng,
    slug = NEW.slug,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    boundary_lines = NEW.boundary_lines,
    county_id = NEW.county_id,
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cities_instead_of_update
INSTEAD OF UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_update_trigger();

CREATE OR REPLACE FUNCTION public.cities_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.cities WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER cities_instead_of_delete
INSTEAD OF DELETE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_delete_trigger();

-- Similar triggers for counties
CREATE OR REPLACE FUNCTION public.counties_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.counties (
    name, population, area_sq_mi, polygon,
    meta_title, meta_description, website_url, other_urls, favorite,
    view_count, slug, created_at, updated_at
  )
  VALUES (
    NEW.name, 
    NEW.population, 
    NEW.area_sq_mi, 
    NEW.polygon,
    NEW.meta_title, 
    NEW.meta_description, 
    NEW.website_url, 
    NEW.other_urls, 
    COALESCE(NEW.favorite, false),
    COALESCE(NEW.view_count, 0), 
    NEW.slug,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER counties_instead_of_insert
INSTEAD OF INSERT ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_insert_trigger();

CREATE OR REPLACE FUNCTION public.counties_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.counties
  SET
    name = COALESCE(NEW.name, OLD.name),
    population = COALESCE(NEW.population, OLD.population),
    area_sq_mi = COALESCE(NEW.area_sq_mi, OLD.area_sq_mi),
    polygon = NEW.polygon,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    other_urls = NEW.other_urls,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    slug = NEW.slug,
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER counties_instead_of_update
INSTEAD OF UPDATE ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_update_trigger();

CREATE OR REPLACE FUNCTION public.counties_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.counties WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER counties_instead_of_delete
INSTEAD OF DELETE ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_delete_trigger();

-- Triggers for city_counties (create functions first, then triggers conditionally)
CREATE OR REPLACE FUNCTION public.city_counties_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.city_counties (city_id, county_id, is_primary, created_at)
  VALUES (
    NEW.city_id, 
    NEW.county_id, 
    COALESCE(NEW.is_primary, false),
    COALESCE(NEW.created_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.city_counties_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.city_counties
  SET
    city_id = COALESCE(NEW.city_id, OLD.city_id),
    county_id = COALESCE(NEW.county_id, OLD.county_id),
    is_primary = COALESCE(NEW.is_primary, OLD.is_primary)
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.city_counties_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.city_counties WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- Create triggers for city_counties if view exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'city_counties') THEN
    CREATE TRIGGER city_counties_instead_of_insert
    INSTEAD OF INSERT ON public.city_counties
    FOR EACH ROW
    EXECUTE FUNCTION public.city_counties_insert_trigger();

    CREATE TRIGGER city_counties_instead_of_update
    INSTEAD OF UPDATE ON public.city_counties
    FOR EACH ROW
    EXECUTE FUNCTION public.city_counties_update_trigger();

    CREATE TRIGGER city_counties_instead_of_delete
    INSTEAD OF DELETE ON public.city_counties
    FOR EACH ROW
    EXECUTE FUNCTION public.city_counties_delete_trigger();
    
    GRANT INSERT, UPDATE, DELETE ON public.city_counties TO authenticated;
  END IF;
END;
$$;

-- Grant INSERT, UPDATE, DELETE on views (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.counties TO authenticated;

-- ============================================================================
-- STEP 14: Add comments
-- ============================================================================

COMMENT ON SCHEMA atlas IS 'Schema for geographic reference data: cities, counties, and their relationships';
COMMENT ON TABLE atlas.cities IS 'Standalone reference table for Minnesota cities. Can be referenced by id from other tables.';
COMMENT ON TABLE atlas.counties IS 'Standalone reference table for Minnesota counties with population and area data';
COMMENT ON TABLE atlas.city_counties IS 'Junction table linking cities to counties. Allows cities to be associated with multiple counties.';
COMMENT ON VIEW public.cities IS 'View pointing to atlas.cities for Supabase client compatibility';
COMMENT ON VIEW public.counties IS 'View pointing to atlas.counties for Supabase client compatibility';
COMMENT ON VIEW public.city_counties IS 'View pointing to atlas.city_counties for Supabase client compatibility';

-- ============================================================================
-- STEP 15: Verification report
-- ============================================================================

DO $$
DECLARE
  v_cities_count INTEGER;
  v_counties_count INTEGER;
  v_city_counties_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cities_count FROM atlas.cities;
  SELECT COUNT(*) INTO v_counties_count FROM atlas.counties;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'atlas' AND table_name = 'city_counties') THEN
    SELECT COUNT(*) INTO v_city_counties_count FROM atlas.city_counties;
  ELSE
    v_city_counties_count := 0;
  END IF;

  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Cities moved to atlas schema: %', v_cities_count;
  RAISE NOTICE '  Counties moved to atlas schema: %', v_counties_count;
  RAISE NOTICE '  City-county relationships: %', v_city_counties_count;
END;
$$;







