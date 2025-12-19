-- Ensure lakes table is in atlas schema
-- Migration 212: Move lakes to atlas schema if not already there

-- ============================================================================
-- STEP 1: Check current location of lakes table
-- ============================================================================

DO $$
DECLARE
  v_schema_name TEXT;
  v_table_exists BOOLEAN;
BEGIN
  -- Check if lakes exists in public schema
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lakes'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    -- Move from public to atlas
    ALTER TABLE public.lakes SET SCHEMA atlas;
    RAISE NOTICE 'Moved lakes table from public to atlas schema';
  ELSE
    -- Check if it's already in atlas
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'atlas' AND table_name = 'lakes'
    ) INTO v_table_exists;

    IF v_table_exists THEN
      RAISE NOTICE 'Lakes table already exists in atlas schema';
    ELSE
      RAISE NOTICE 'Lakes table does not exist in either schema';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop public view if it exists (from previous migration)
-- ============================================================================

DROP VIEW IF EXISTS public.lakes CASCADE;

-- ============================================================================
-- STEP 3: Ensure atlas schema exists
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS atlas;

-- ============================================================================
-- STEP 4: Update RLS policies on atlas.lakes (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'atlas' AND table_name = 'lakes'
  ) THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Anyone can view lakes" ON atlas.lakes;
    DROP POLICY IF EXISTS "Admins can insert lakes" ON atlas.lakes;
    DROP POLICY IF EXISTS "Admins can update lakes" ON atlas.lakes;
    DROP POLICY IF EXISTS "Admins can delete lakes" ON atlas.lakes;

    -- Recreate policies
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

    -- Update grants
    GRANT SELECT ON atlas.lakes TO authenticated, anon;
    GRANT INSERT, UPDATE, DELETE ON atlas.lakes TO authenticated;
    GRANT ALL ON atlas.lakes TO service_role;

    RAISE NOTICE 'Updated RLS policies and grants for atlas.lakes';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create public view for Supabase client compatibility
-- ============================================================================

-- Create view in public schema that points to atlas schema table
CREATE OR REPLACE VIEW public.lakes AS
SELECT * FROM atlas.lakes;

-- Grant permissions on view
GRANT SELECT ON public.lakes TO authenticated, anon;

-- Create INSTEAD OF triggers to make view updatable
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

DROP TRIGGER IF EXISTS lakes_instead_of_insert ON public.lakes;
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

DROP TRIGGER IF EXISTS lakes_instead_of_update ON public.lakes;
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

DROP TRIGGER IF EXISTS lakes_instead_of_delete ON public.lakes;
CREATE TRIGGER lakes_instead_of_delete
INSTEAD OF DELETE ON public.lakes
FOR EACH ROW
EXECUTE FUNCTION public.lakes_delete_trigger();

-- Grant INSERT, UPDATE, DELETE on view (for triggers)
GRANT INSERT, UPDATE, DELETE ON public.lakes TO authenticated;

COMMENT ON VIEW public.lakes IS 'View pointing to atlas.lakes for Supabase client compatibility';


