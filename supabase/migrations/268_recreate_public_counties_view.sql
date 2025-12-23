-- Recreate public.counties view pointing to atlas.counties
-- This view allows Supabase client code to use .from('counties') without changes
-- Includes INSTEAD OF triggers for write operations

-- ============================================================================
-- STEP 1: Drop existing triggers if they exist
-- ============================================================================

DROP TRIGGER IF EXISTS counties_instead_of_insert ON public.counties;
DROP TRIGGER IF EXISTS counties_instead_of_update ON public.counties;
DROP TRIGGER IF EXISTS counties_instead_of_delete ON public.counties;

-- ============================================================================
-- STEP 2: Drop existing view
-- ============================================================================

DROP VIEW IF EXISTS public.counties CASCADE;

-- ============================================================================
-- STEP 3: Recreate the view pointing to atlas.counties
-- ============================================================================

CREATE OR REPLACE VIEW public.counties AS
SELECT * FROM atlas.counties;

-- ============================================================================
-- STEP 4: Create INSTEAD OF trigger functions for write operations
-- ============================================================================

-- Insert trigger function
CREATE OR REPLACE FUNCTION public.counties_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.counties (
    name, population, area_sq_mi, polygon, meta_title, meta_description, 
    website_url, other_urls, favorite, view_count, mn_id, created_at, updated_at
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
    COALESCE(NEW.mn_id, atlas.generate_mn_id()),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Update trigger function
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
    area_sq_mi = NEW.area_sq_mi,
    polygon = NEW.polygon,
    meta_title = NEW.meta_title,
    meta_description = NEW.meta_description,
    website_url = NEW.website_url,
    other_urls = NEW.other_urls,
    favorite = COALESCE(NEW.favorite, OLD.favorite),
    view_count = COALESCE(NEW.view_count, OLD.view_count),
    mn_id = COALESCE(NEW.mn_id, OLD.mn_id),
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

-- Delete trigger function
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

-- ============================================================================
-- STEP 5: Create INSTEAD OF triggers
-- ============================================================================

CREATE TRIGGER counties_instead_of_insert
INSTEAD OF INSERT ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_insert_trigger();

CREATE TRIGGER counties_instead_of_update
INSTEAD OF UPDATE ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_update_trigger();

CREATE TRIGGER counties_instead_of_delete
INSTEAD OF DELETE ON public.counties
FOR EACH ROW
EXECUTE FUNCTION public.counties_delete_trigger();

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

-- Read access for all users
GRANT SELECT ON public.counties TO authenticated, anon;

-- Full access for service_role (for admin operations)
GRANT ALL ON public.counties TO service_role;

-- ============================================================================
-- STEP 7: Add comments
-- ============================================================================

COMMENT ON VIEW public.counties IS 
  'Public-facing view of atlas.counties with INSTEAD OF triggers for CRUD operations. Allows Supabase client code to use .from(''counties'') without changes. Service role has full access.';

COMMENT ON FUNCTION public.counties_insert_trigger() IS 
  'INSTEAD OF INSERT trigger for public.counties view. Routes inserts to atlas.counties table. Automatically generates mn_id if not provided.';

COMMENT ON FUNCTION public.counties_update_trigger() IS 
  'INSTEAD OF UPDATE trigger for public.counties view. Routes updates to atlas.counties table.';

COMMENT ON FUNCTION public.counties_delete_trigger() IS 
  'INSTEAD OF DELETE trigger for public.counties view. Routes deletes to atlas.counties table.';

