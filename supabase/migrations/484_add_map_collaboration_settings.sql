-- Add map collaboration settings columns
-- Allows map owners to control whether authenticated users can add pins, areas, and create posts on their maps
-- These settings only apply to public maps - private maps always require ownership

-- ============================================================================
-- STEP 1: Add collaboration settings columns
-- ============================================================================

-- Note: allow_others_to_post_pins already exists from migration 317
-- Add columns for areas and posts
ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS allow_others_to_add_areas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_others_to_create_posts BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- STEP 2: Create indexes for filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_allow_others_to_add_areas 
  ON public.map(allow_others_to_add_areas) 
  WHERE allow_others_to_add_areas = true;

CREATE INDEX IF NOT EXISTS idx_map_allow_others_to_create_posts 
  ON public.map(allow_others_to_create_posts) 
  WHERE allow_others_to_create_posts = true;

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON COLUMN public.map.allow_others_to_post_pins IS 'If true, allows authenticated users (who are not the map owner) to add pins on this public map';
COMMENT ON COLUMN public.map.allow_others_to_add_areas IS 'If true, allows authenticated users (who are not the map owner) to add areas on this public map';
COMMENT ON COLUMN public.map.allow_others_to_create_posts IS 'If true, allows authenticated users (who are not the map owner) to create posts with map_data on this public map';

-- ============================================================================
-- STEP 4: Update RLS policies for map_pins
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create pins on accessible maps" ON public.map_pins;

-- Create updated policy that checks allow_others_to_post_pins setting
CREATE POLICY "Users can create pins on accessible maps"
  ON public.map_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND (
        -- Map owner can always create pins
        EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = map.account_id
          AND accounts.user_id = auth.uid()
        )
        OR
        -- Public maps with allow_others_to_post_pins enabled allow anyone to create pins
        (
          map.visibility = 'public'
          AND map.allow_others_to_post_pins = true
        )
      )
    )
  );

-- ============================================================================
-- STEP 5: Update RLS policies for map_areas
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create areas on accessible maps" ON public.map_areas;

-- Create updated policy that checks allow_others_to_add_areas setting
CREATE POLICY "Users can create areas on accessible maps"
  ON public.map_areas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
      AND (
        -- Map owner can always create areas
        EXISTS (
          SELECT 1 FROM public.accounts
          WHERE accounts.id = map.account_id
          AND accounts.user_id = auth.uid()
        )
        OR
        -- Public maps with allow_others_to_add_areas enabled allow anyone to create areas
        (
          map.visibility = 'public'
          AND map.allow_others_to_add_areas = true
        )
      )
    )
  );

-- ============================================================================
-- STEP 6: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
