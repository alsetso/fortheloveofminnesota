-- Drop pins table and all related objects
-- This migration removes the pins table and all dependencies
-- IMPORTANT: Migrates pin_views tracking to work with mentions table

-- ============================================================================
-- STEP 0: Migrate pin_views to work with mentions table
-- ============================================================================

-- First, drop the foreign key constraint on analytics.pin_views
ALTER TABLE IF EXISTS analytics.pin_views 
  DROP CONSTRAINT IF EXISTS pin_views_pin_id_fkey;

-- Clean up any orphaned pin_views records that reference pins not in mentions
-- This ensures the new foreign key constraint can be added successfully
DELETE FROM analytics.pin_views
WHERE pin_id NOT IN (SELECT id FROM public.mentions);

-- Update the foreign key to reference mentions instead of pins
ALTER TABLE analytics.pin_views
  ADD CONSTRAINT pin_views_pin_id_fkey 
  FOREIGN KEY (pin_id) 
  REFERENCES public.mentions(id) 
  ON DELETE CASCADE;

-- Update record_pin_view function to check mentions instead of pins
CREATE OR REPLACE FUNCTION analytics.record_pin_view(
  p_pin_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_view_id UUID;
BEGIN
  -- Validate pin_id
  IF p_pin_id IS NULL THEN
    RAISE EXCEPTION 'pin_id cannot be NULL';
  END IF;
  
  -- Verify mention exists (was pin)
  IF NOT EXISTS (SELECT 1 FROM public.mentions WHERE id = p_pin_id) THEN
    RAISE EXCEPTION 'Mention with id % does not exist', p_pin_id;
  END IF;
  
  -- Insert pin view record (still called pin_view for backward compatibility)
  INSERT INTO analytics.pin_views (
    pin_id,
    account_id,
    user_agent,
    referrer_url,
    session_id,
    viewed_at
  )
  VALUES (
    p_pin_id,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id,
    NOW()
  )
  RETURNING id INTO v_view_id;
  
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_pin_viewers function to reference mentions
CREATE OR REPLACE FUNCTION analytics.get_pin_viewers(
  p_pin_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pv.account_id)
    a.id AS account_id,
    a.username AS account_username,
    a.first_name AS account_first_name,
    a.last_name AS account_last_name,
    a.image_url AS account_image_url,
    MAX(pv.viewed_at) AS viewed_at,
    COUNT(*)::BIGINT AS view_count
  FROM analytics.pin_views pv
  LEFT JOIN public.accounts a ON pv.account_id = a.id
  WHERE pv.pin_id = p_pin_id
    AND pv.account_id IS NOT NULL
  GROUP BY a.id, a.username, a.first_name, a.last_name, a.image_url, pv.account_id
  ORDER BY pv.account_id, MAX(pv.viewed_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policy on analytics.pin_views to check mentions.account_id instead of pins.account_id
DROP POLICY IF EXISTS "Users can view views of own pins" ON analytics.pin_views;

CREATE POLICY "Users can view views of own mentions"
  ON analytics.pin_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentions
      WHERE mentions.id = pin_views.pin_id
      AND mentions.account_id = (SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Update public wrapper function for record_pin_view
CREATE OR REPLACE FUNCTION public.record_pin_view(
  p_pin_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN analytics.record_pin_view(
    p_pin_id,
    p_account_id,
    p_user_agent,
    p_referrer_url,
    p_session_id
  );
END;
$$;

-- Update public wrapper function for get_pin_viewers
CREATE OR REPLACE FUNCTION public.get_pin_viewers(
  p_pin_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  account_id UUID,
  account_username TEXT,
  account_first_name TEXT,
  account_last_name TEXT,
  account_image_url TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.get_pin_viewers(p_pin_id, p_limit, p_offset);
END;
$$;

-- Update comment on pin_views table
COMMENT ON TABLE analytics.pin_views IS
  'Mention view tracking (formerly pin views). Tracks WHO views each mention. pin_id now references mentions.id.';

COMMENT ON COLUMN analytics.pin_views.pin_id IS
  'ID of the mention being viewed (formerly pin_id, now references mentions.id).';

COMMENT ON FUNCTION analytics.record_pin_view IS
  'Records a mention view (formerly pin view). Returns the view ID. pin_id now references mentions.id.';

COMMENT ON FUNCTION public.record_pin_view IS
  'Public wrapper for analytics.record_pin_view. Records a mention view (formerly pin view).';

COMMENT ON FUNCTION analytics.get_pin_viewers IS
  'Returns list of accounts that viewed a mention (formerly pin), with view counts.';

COMMENT ON FUNCTION public.get_pin_viewers IS
  'Public wrapper for analytics.get_pin_viewers. Returns list of accounts that viewed a mention (formerly pin).';

COMMENT ON POLICY "Users can view views of own mentions" ON analytics.pin_views IS
  'Allows users to view pin_views for mentions they own. Updated to reference mentions table instead of pins.';

-- ============================================================================
-- STEP 1: Drop all RLS policies on pins table
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pins', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Drop all triggers on pins table
-- ============================================================================

DROP TRIGGER IF EXISTS update_pins_updated_at ON public.pins;

-- ============================================================================
-- STEP 3: Drop all indexes on pins table
-- ============================================================================

DROP INDEX IF EXISTS idx_pins_lat_lng;
DROP INDEX IF EXISTS idx_pins_type;
DROP INDEX IF EXISTS idx_pins_account_id;
DROP INDEX IF EXISTS idx_pins_city_id;
DROP INDEX IF EXISTS idx_pins_county_id;
DROP INDEX IF EXISTS idx_pins_created_at;
DROP INDEX IF EXISTS idx_pins_visibility;
DROP INDEX IF EXISTS idx_pins_view_count;
DROP INDEX IF EXISTS idx_pins_media_url;
DROP INDEX IF EXISTS idx_pins_tags;
DROP INDEX IF EXISTS idx_pins_location_metadata_category;
DROP INDEX IF EXISTS idx_pins_atlas_metadata_type;
DROP INDEX IF EXISTS idx_pins_archived;
DROP INDEX IF EXISTS idx_pins_active;
DROP INDEX IF EXISTS idx_pins_hide_location;
DROP INDEX IF EXISTS idx_pins_event_date;
DROP INDEX IF EXISTS idx_pins_account_id_visibility;
DROP INDEX IF EXISTS idx_pins_visibility_account_id;
DROP INDEX IF EXISTS idx_pins_slug;
DROP INDEX IF EXISTS idx_pins_category;
DROP INDEX IF EXISTS idx_pins_access_list;
DROP INDEX IF EXISTS idx_pins_expires;
DROP INDEX IF EXISTS idx_pins_expiration_date;
DROP INDEX IF EXISTS idx_pins_status;

-- ============================================================================
-- STEP 4: Drop foreign key constraints (if any exist)
-- ============================================================================

-- Note: Foreign keys will be dropped automatically when table is dropped
-- But we'll drop them explicitly to be safe

ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_account_id_fkey;
ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_city_id_fkey;
ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_county_id_fkey;
ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_tag_id_fkey;
ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_profile_id_fkey;
ALTER TABLE IF EXISTS public.pins DROP CONSTRAINT IF EXISTS pins_created_by_fkey;

-- ============================================================================
-- STEP 5: Drop the pins table
-- ============================================================================

DROP TABLE IF EXISTS public.pins CASCADE;

-- ============================================================================
-- STEP 6: Drop related enums (only if not used elsewhere)
-- ============================================================================

-- Check if pin_category enum is used elsewhere before dropping
DO $$
BEGIN
  -- Only drop if not used by other tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'pin_category'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE udt_name = 'pin_category'
      AND table_name != 'pins'
    )
  ) THEN
    DROP TYPE IF EXISTS public.pin_category CASCADE;
  END IF;
END $$;

-- Check if pin_status enum is used elsewhere before dropping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'pin_status'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE udt_name = 'pin_status'
      AND table_name != 'pins'
    )
  ) THEN
    DROP TYPE IF EXISTS public.pin_status CASCADE;
  END IF;
END $$;

-- Check if pin_visibility enum is used elsewhere before dropping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'pin_visibility'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE udt_name = 'pin_visibility'
      AND table_name != 'pins'
    )
  ) THEN
    DROP TYPE IF EXISTS public.pin_visibility CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Drop any functions related to pins
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_pins_updated_at() CASCADE;

-- ============================================================================
-- STEP 8: Revoke permissions (if any exist)
-- ============================================================================

REVOKE ALL ON TABLE public.pins FROM authenticated;
REVOKE ALL ON TABLE public.pins FROM anon;
REVOKE ALL ON TABLE public.pins FROM public;

COMMENT ON SCHEMA public IS 'Pins table has been dropped and replaced with mentions table.';
