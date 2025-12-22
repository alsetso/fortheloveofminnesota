-- Recreate public.cities view pointing to atlas.cities
-- This view allows Supabase client code to use .from('cities') without changes
-- Includes INSTEAD OF triggers for write operations

-- ============================================================================
-- STEP 1: Drop existing triggers if they exist
-- ============================================================================

DROP TRIGGER IF EXISTS cities_instead_of_insert ON public.cities;
DROP TRIGGER IF EXISTS cities_instead_of_update ON public.cities;
DROP TRIGGER IF EXISTS cities_instead_of_delete ON public.cities;

-- ============================================================================
-- STEP 2: Drop existing view
-- ============================================================================

DROP VIEW IF EXISTS public.cities CASCADE;

-- ============================================================================
-- STEP 3: Recreate the view pointing to atlas.cities
-- ============================================================================

CREATE OR REPLACE VIEW public.cities AS
SELECT * FROM atlas.cities;

-- ============================================================================
-- STEP 4: Create INSTEAD OF trigger functions for write operations
-- ============================================================================

-- Insert trigger function
CREATE OR REPLACE FUNCTION public.cities_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.cities (
    name, population, county, lat, lng, slug,
    meta_title, meta_description, website_url, favorite,
    view_count, boundary_lines, county_id, mn_id, created_at, updated_at
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
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Update trigger function
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
    mn_id = COALESCE(NEW.mn_id, OLD.mn_id),
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Delete trigger function
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

-- ============================================================================
-- STEP 5: Create INSTEAD OF triggers
-- ============================================================================

CREATE TRIGGER cities_instead_of_insert
INSTEAD OF INSERT ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_insert_trigger();

CREATE TRIGGER cities_instead_of_update
INSTEAD OF UPDATE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_update_trigger();

CREATE TRIGGER cities_instead_of_delete
INSTEAD OF DELETE ON public.cities
FOR EACH ROW
EXECUTE FUNCTION public.cities_delete_trigger();

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

-- Read access for all users
GRANT SELECT ON public.cities TO authenticated, anon;

-- Full access for service_role (for admin operations)
GRANT ALL ON public.cities TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON VIEW public.cities IS 
  'Public-facing view of atlas.cities with INSTEAD OF triggers for CRUD operations. Allows Supabase client code to use .from(''cities'') without changes. Service role has full access.';

COMMENT ON FUNCTION public.cities_insert_trigger() IS 
  'INSTEAD OF INSERT trigger for public.cities view. Routes inserts to atlas.cities table. Automatically generates mn_id if not provided.';

COMMENT ON FUNCTION public.cities_update_trigger() IS 
  'INSTEAD OF UPDATE trigger for public.cities view. Routes updates to atlas.cities table.';

COMMENT ON FUNCTION public.cities_delete_trigger() IS 
  'INSTEAD OF DELETE trigger for public.cities view. Routes deletes to atlas.cities table.';
