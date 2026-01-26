-- Map System Redesign - Phase 3: Remove Old Columns & Finalize
-- This migration removes deprecated columns after data migration is complete
-- WARNING: This is a breaking change - ensure all code is updated first

-- ============================================================================
-- STEP 1: Ensure all maps have slugs before making it NOT NULL
-- ============================================================================

-- Final check: ensure all maps have slugs (should already be done in Phase 2)
UPDATE public.map
SET custom_slug = public.generate_map_slug(COALESCE(title, 'map'))
WHERE custom_slug IS NULL OR custom_slug = '';

-- Ensure name and slug columns are populated from title/custom_slug
UPDATE public.map
SET name = title
WHERE name IS NULL;

UPDATE public.map
SET slug = custom_slug
WHERE slug IS NULL;

-- ============================================================================
-- STEP 2: Update visibility constraint to remove 'shared'
-- ============================================================================

-- Remove old CHECK constraint
ALTER TABLE public.map
  DROP CONSTRAINT IF EXISTS map_visibility_check;

-- Add new CHECK constraint (only public/private)
ALTER TABLE public.map
  ADD CONSTRAINT map_visibility_check 
  CHECK (visibility IN ('private', 'public'));

-- Ensure no 'shared' maps remain (should be converted in Phase 2)
UPDATE public.map
SET visibility = 'private'
WHERE visibility = 'shared';

-- ============================================================================
-- STEP 3: Make slug NOT NULL and add constraints
-- ============================================================================

-- Ensure slug is populated
UPDATE public.map
SET slug = COALESCE(slug, custom_slug, public.generate_map_slug(COALESCE(name, title, 'map')))
WHERE slug IS NULL;

-- Make slug NOT NULL
ALTER TABLE public.map
  ALTER COLUMN slug SET NOT NULL;

-- Add slug format constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'map_slug_format'
  ) THEN
    ALTER TABLE public.map
      ADD CONSTRAINT map_slug_format 
      CHECK (slug ~ '^[a-z0-9-]+$');
  END IF;
END $$;

-- Add slug length constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'map_slug_length'
  ) THEN
    ALTER TABLE public.map
      ADD CONSTRAINT map_slug_length 
      CHECK (char_length(slug) >= 3 AND char_length(slug) <= 100);
  END IF;
END $$;

-- Make slug unique if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'map' 
    AND indexname = 'map_slug_key'
  ) THEN
    CREATE UNIQUE INDEX map_slug_key ON public.map(slug);
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Make name NOT NULL
-- ============================================================================

-- Ensure name is populated
UPDATE public.map
SET name = COALESCE(name, title, 'Untitled Map')
WHERE name IS NULL;

-- Make name NOT NULL
ALTER TABLE public.map
  ALTER COLUMN name SET NOT NULL;

-- Add name length constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'map_name_length'
  ) THEN
    ALTER TABLE public.map
      ADD CONSTRAINT map_name_length 
      CHECK (char_length(name) >= 1 AND char_length(name) <= 200);
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Remove sync triggers (no longer needed)
-- ============================================================================

DROP TRIGGER IF EXISTS sync_map_title_name_trigger ON public.map;
DROP FUNCTION IF EXISTS public.sync_map_title_name();

-- ============================================================================
-- STEP 6: Remove old columns (BREAKING CHANGE)
-- ============================================================================

-- Remove old identity columns (replaced by name/slug)
ALTER TABLE public.map DROP COLUMN IF EXISTS title;
ALTER TABLE public.map DROP COLUMN IF EXISTS custom_slug;

-- Remove old categorization columns (replaced by map_categories)
ALTER TABLE public.map DROP COLUMN IF EXISTS type;
ALTER TABLE public.map DROP COLUMN IF EXISTS collection_type;

-- Remove old settings columns (replaced by settings JSONB)
ALTER TABLE public.map DROP COLUMN IF EXISTS map_style;
ALTER TABLE public.map DROP COLUMN IF EXISTS map_layers;
ALTER TABLE public.map DROP COLUMN IF EXISTS meta;

-- Remove old presentation columns (replaced by settings.presentation)
ALTER TABLE public.map DROP COLUMN IF EXISTS hide_creator;
ALTER TABLE public.map DROP COLUMN IF EXISTS is_primary;

-- Remove old collaboration columns (replaced by settings.collaboration)
ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_post_pins;
ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_add_areas;
ALTER TABLE public.map DROP COLUMN IF EXISTS allow_others_to_create_posts;

-- ============================================================================
-- STEP 7: Drop old indexes that reference removed columns
-- ============================================================================

DROP INDEX IF EXISTS idx_map_allow_others_to_post_pins;
DROP INDEX IF EXISTS idx_map_allow_others_to_add_areas;
DROP INDEX IF EXISTS idx_map_allow_others_to_create_posts;
DROP INDEX IF EXISTS idx_map_meta;
DROP INDEX IF EXISTS idx_map_map_layers;

-- ============================================================================
-- STEP 8: Update map_style enum (if it exists and is no longer used)
-- ============================================================================

-- Check if map_style enum exists and is not used elsewhere
DO $$
BEGIN
  -- Only drop if not used by any other table
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'map_style'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE udt_name = 'map_style'
  ) THEN
    DROP TYPE IF EXISTS public.map_style;
  END IF;
END $$;

-- ============================================================================
-- STEP 9: Update RLS policies to use new structure
-- ============================================================================

-- Drop old policies that might reference removed columns
DROP POLICY IF EXISTS "Users can view accessible maps" ON public.map;
DROP POLICY IF EXISTS "Users can create maps" ON public.map;
DROP POLICY IF EXISTS "Users can update own maps" ON public.map;
DROP POLICY IF EXISTS "Users can delete own maps" ON public.map;

-- Create new RLS policies using member system
-- Public maps: visible to everyone (if active)
CREATE POLICY "maps_select_public"
  ON public.map FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
    AND is_active = true
  );

-- Private maps: visible to members
CREATE POLICY "maps_select_private_members"
  ON public.map FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'
    AND is_active = true
    AND public.is_map_member(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Authenticated users can create maps
CREATE POLICY "maps_insert"
  ON public.map FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND account_id IS NOT NULL
    AND public.user_owns_account(account_id)
    AND created_by_account_id IS NOT NULL
    AND created_by_account_id = account_id
  );

-- Only managers can update maps
CREATE POLICY "maps_update"
  ON public.map FOR UPDATE
  TO authenticated
  USING (
    public.is_map_manager(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  )
  WITH CHECK (
    public.is_map_manager(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- Only owners can delete maps (soft delete via is_active)
CREATE POLICY "maps_delete"
  ON public.map FOR DELETE
  TO authenticated
  USING (
    public.is_map_owner(id, (
      SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
    ))
  );

-- ============================================================================
-- STEP 10: Update map_pins and map_areas RLS to use member system
-- ============================================================================

-- Update map_pins INSERT policy to check member roles + settings
DROP POLICY IF EXISTS "Users can create pins on accessible maps" ON public.map_pins;

CREATE POLICY "Users can create pins on accessible maps"
  ON public.map_pins FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_pins.map_id
      AND map.is_active = true
      AND (
        -- Map managers can always create pins
        public.is_map_manager(map.id, (
          SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
        ))
        OR
        -- Public maps with collaboration enabled
        (
          map.visibility = 'public'
          AND (map.settings->'collaboration'->>'allow_pins')::boolean = true
        )
        OR
        -- Private map editors
        (
          map.visibility = 'private'
          AND public.is_map_member(map.id, (
            SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
          ))
          AND EXISTS (
            SELECT 1 FROM public.map_members
            WHERE map_members.map_id = map.id
            AND map_members.account_id = (
              SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
            )
            AND map_members.role IN ('owner', 'manager', 'editor')
          )
        )
      )
    )
  );

-- Update map_areas INSERT policy to check member roles + settings
DROP POLICY IF EXISTS "Users can create areas on accessible maps" ON public.map_areas;

CREATE POLICY "Users can create areas on accessible maps"
  ON public.map_areas FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.map
      WHERE map.id = map_areas.map_id
      AND map.is_active = true
      AND (
        -- Map managers can always create areas
        public.is_map_manager(map.id, (
          SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
        ))
        OR
        -- Public maps with collaboration enabled
        (
          map.visibility = 'public'
          AND (map.settings->'collaboration'->>'allow_areas')::boolean = true
        )
        OR
        -- Private map editors
        (
          map.visibility = 'private'
          AND public.is_map_member(map.id, (
            SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
          ))
          AND EXISTS (
            SELECT 1 FROM public.map_members
            WHERE map_members.map_id = map.id
            AND map_members.account_id = (
              SELECT id FROM public.accounts WHERE user_id = auth.uid() LIMIT 1
            )
            AND map_members.role IN ('owner', 'manager', 'editor')
          )
        )
      )
    )
  );

-- ============================================================================
-- STEP 11: Update generate_map_slug to check slug column (now exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_map_slug(p_map_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  random_words TEXT[];
  word1 TEXT;
  word2 TEXT;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(p_map_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Ensure base slug is not empty
  IF base_slug = '' THEN
    base_slug := 'map';
  END IF;
  
  -- Random word arrays
  random_words := ARRAY['minnesota', 'twin', 'cities', 'north', 'south', 'east', 'west', 'lake', 'river', 'park'];
  
  -- Pick two random words
  word1 := random_words[1 + floor(random() * array_length(random_words, 1))::int];
  word2 := random_words[1 + floor(random() * array_length(random_words, 1))::int];
  
  -- Add random suffix (2 words + 3-4 digit number)
  final_slug := base_slug || '-' || word1 || '-' || word2 || '-' || 
    (100 + floor(random() * 9000))::text;
  
  -- Ensure uniqueness (check slug column which now exists)
  WHILE EXISTS (SELECT 1 FROM public.map WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter || '-' || 
      (1000 + floor(random() * 9000))::text;
    
    -- Prevent infinite loop
    IF counter > 1000 THEN
      final_slug := base_slug || '-' || extract(epoch from now())::bigint;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

ALTER FUNCTION public.generate_map_slug(TEXT) OWNER TO postgres;

-- ============================================================================
-- STEP 12: Add comments for final structure
-- ============================================================================

COMMENT ON TABLE public.map IS 'Maps with member management, consolidated settings, and category support. Similar structure to groups.';
COMMENT ON COLUMN public.map.name IS 'Map name (renamed from title)';
COMMENT ON COLUMN public.map.slug IS 'URL-friendly identifier (renamed from custom_slug, always required)';
COMMENT ON COLUMN public.map.visibility IS 'Map visibility: public (everyone) or private (members only)';
COMMENT ON COLUMN public.map.settings IS 'Consolidated settings JSONB: {appearance: {...}, collaboration: {...}, presentation: {...}}';

-- ============================================================================
-- STEP 13: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
