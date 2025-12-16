-- Move lakes table to atlas schema
-- This continues organizing geographic reference data in the atlas schema

-- ============================================================================
-- STEP 0: Verify table exists before proceeding
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lakes') THEN
    RAISE EXCEPTION 'Table public.lakes does not exist. Cannot proceed with migration.';
  END IF;
END;
$$;

-- ============================================================================
-- STEP 1: Move lakes table to atlas schema
-- ============================================================================

ALTER TABLE public.lakes SET SCHEMA atlas;

-- Triggers and indexes move automatically with the table
-- No changes needed

-- ============================================================================
-- STEP 2: Update RLS policies for lakes
-- ============================================================================

-- Policies moved with the table, but we need to ensure they exist and are correct
-- Drop existing policies first, then recreate to ensure consistency

DROP POLICY IF EXISTS "Anyone can view lakes" ON atlas.lakes;
DROP POLICY IF EXISTS "Admins can insert lakes" ON atlas.lakes;
DROP POLICY IF EXISTS "Admins can update lakes" ON atlas.lakes;
DROP POLICY IF EXISTS "Admins can delete lakes" ON atlas.lakes;

-- Recreate policies on atlas.lakes
CREATE POLICY "Anyone can view lakes"
  ON atlas.lakes
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can insert lakes"
  ON atlas.lakes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update lakes"
  ON atlas.lakes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete lakes"
  ON atlas.lakes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 3: Update grants/permissions
-- ============================================================================

-- Grant permissions on atlas schema table
GRANT SELECT ON atlas.lakes TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON atlas.lakes TO authenticated;

-- Grant service_role permissions
GRANT ALL ON atlas.lakes TO service_role;

-- ============================================================================
-- STEP 4: Create public view for Supabase client compatibility
-- ============================================================================

-- Supabase PostgREST only exposes the public schema by default
-- Create view in public schema that points to atlas schema table
-- This allows existing client code to work without changes

CREATE OR REPLACE VIEW public.lakes AS
SELECT * FROM atlas.lakes;

-- Grant permissions on view
GRANT SELECT ON public.lakes TO authenticated, anon;

-- ============================================================================
-- STEP 5: Create INSTEAD OF triggers to make view updatable
-- ============================================================================

-- Create trigger functions for lakes
CREATE OR REPLACE FUNCTION public.lakes_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO atlas.lakes (
    name, lat, lng, polygon, created_at, updated_at
  )
  VALUES (
    NEW.name,
    NEW.lat,
    NEW.lng,
    NEW.polygon,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lakes_instead_of_insert
INSTEAD OF INSERT ON public.lakes
FOR EACH ROW
EXECUTE FUNCTION public.lakes_insert_trigger();

CREATE OR REPLACE FUNCTION public.lakes_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE atlas.lakes
  SET
    name = COALESCE(NEW.name, OLD.name),
    lat = NEW.lat,
    lng = NEW.lng,
    polygon = NEW.polygon,
    updated_at = NOW()
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lakes_instead_of_update
INSTEAD OF UPDATE ON public.lakes
FOR EACH ROW
EXECUTE FUNCTION public.lakes_update_trigger();

CREATE OR REPLACE FUNCTION public.lakes_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM atlas.lakes WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER lakes_instead_of_delete
INSTEAD OF DELETE ON public.lakes
FOR EACH ROW
EXECUTE FUNCTION public.lakes_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.lakes TO authenticated;

-- ============================================================================
-- STEP 6: Add comments
-- ============================================================================

COMMENT ON TABLE atlas.lakes IS 'Standalone reference table for Minnesota lakes with coordinates and polygon boundaries';
COMMENT ON VIEW public.lakes IS 'View pointing to atlas.lakes for Supabase client compatibility';

-- ============================================================================
-- STEP 7: Verification report
-- ============================================================================

DO $$
DECLARE
  v_lakes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_lakes_count FROM atlas.lakes;

  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '  Lakes moved to atlas schema: %', v_lakes_count;
END;
$$;

