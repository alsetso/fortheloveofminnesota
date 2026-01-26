-- Map System Redesign - Phase 2: Migrate Existing Data
-- This migration migrates data from old columns to new structure
-- Phase 3 will remove old columns

-- ============================================================================
-- STEP 1: Fix generate_map_slug function to check custom_slug (not slug)
-- ============================================================================

-- Update the function to check custom_slug column (which exists)
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
  
  -- Ensure uniqueness (check custom_slug column which exists)
  WHILE EXISTS (SELECT 1 FROM public.map WHERE custom_slug = final_slug) LOOP
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
-- STEP 2: Generate slugs for maps without custom_slug
-- ============================================================================

-- Update maps that don't have custom_slug
UPDATE public.map
SET custom_slug = public.generate_map_slug(COALESCE(title, 'map'))
WHERE custom_slug IS NULL OR custom_slug = '';

-- ============================================================================
-- STEP 3: Migrate settings to settings JSONB
-- ============================================================================

-- First, ensure collaboration columns exist (they should from migration 484, but be safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'allow_others_to_post_pins'
  ) THEN
    ALTER TABLE public.map ADD COLUMN allow_others_to_post_pins BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'allow_others_to_add_areas'
  ) THEN
    ALTER TABLE public.map ADD COLUMN allow_others_to_add_areas BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'allow_others_to_create_posts'
  ) THEN
    ALTER TABLE public.map ADD COLUMN allow_others_to_create_posts BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Migrate map_style, map_layers, meta to settings.appearance
-- Migrate collaboration flags to settings.collaboration
-- Migrate presentation flags to settings.presentation
UPDATE public.map
SET settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{appearance}',
      COALESCE(
        jsonb_build_object(
          'map_style', COALESCE(map_style::text, 'street'),
          'map_layers', COALESCE(map_layers, '{}'::jsonb),
          'meta', COALESCE(meta, '{}'::jsonb)
        ),
        '{}'::jsonb
      )
    ),
    '{collaboration}',
    COALESCE(
      jsonb_build_object(
        'allow_pins', COALESCE(allow_others_to_post_pins, false),
        'allow_areas', COALESCE(allow_others_to_add_areas, false),
        'allow_posts', COALESCE(allow_others_to_create_posts, false)
      ),
      '{}'::jsonb
    )
  ),
  '{presentation}',
  COALESCE(
    jsonb_build_object(
      'hide_creator', COALESCE(hide_creator, false),
      'is_featured', COALESCE(is_primary, false)
    ),
    '{}'::jsonb
  )
)
WHERE settings = '{}'::jsonb OR settings IS NULL;

-- ============================================================================
-- STEP 4: Migrate categories from type/collection_type to map_categories
-- ============================================================================

-- Migrate collection_type (preferred) or type to map_categories
INSERT INTO public.map_categories (map_id, category)
SELECT DISTINCT
  id as map_id,
  CASE 
    WHEN collection_type IS NOT NULL THEN 
      CASE collection_type
        WHEN 'gov' THEN 'government'
        ELSE collection_type
      END
    WHEN type IS NOT NULL THEN
      CASE type
        WHEN 'gov' THEN 'government'
        WHEN 'user-generated' THEN 'user'
        ELSE type
      END
    ELSE 'community' -- Default fallback
  END as category
FROM public.map
WHERE (collection_type IS NOT NULL OR type IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.map_categories 
    WHERE map_categories.map_id = map.id
  )
ON CONFLICT (map_id, category) DO NOTHING;

-- ============================================================================
-- STEP 5: Handle 'shared' visibility → 'private'
-- ============================================================================

-- Convert 'shared' visibility to 'private'
-- Note: If there are existing map_shares, we should migrate them to map_members
-- For now, just convert visibility and owners are already in map_members from Phase 1
UPDATE public.map
SET visibility = 'private'
WHERE visibility = 'shared';

-- If there's a map_share table, migrate those to map_members
-- (This assumes map_share exists from the old system)
DO $$
DECLARE
  share_record RECORD;
BEGIN
  -- Check if map_share table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'map_share'
  ) THEN
    -- Migrate map_share entries to map_members
    FOR share_record IN 
      SELECT ms.map_id, ms.account_id, ms.permission
      FROM public.map_share ms
      WHERE NOT EXISTS (
        SELECT 1 FROM public.map_members mm
        WHERE mm.map_id = ms.map_id
        AND mm.account_id = ms.account_id
      )
    LOOP
      INSERT INTO public.map_members (map_id, account_id, role)
      VALUES (
        share_record.map_id,
        share_record.account_id,
        CASE share_record.permission
          WHEN 'admin' THEN 'manager' -- Old admin → new manager
          WHEN 'edit' THEN 'editor'
          ELSE 'editor' -- Default to editor
        END
      )
      ON CONFLICT (map_id, account_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Rename columns (keep old columns for backward compatibility)
-- ============================================================================

-- Add new columns if they don't exist (for backward compatibility during transition)
DO $$
BEGIN
  -- Add name column (alias for title)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.map ADD COLUMN name TEXT;
    UPDATE public.map SET name = title WHERE name IS NULL;
  END IF;
  
  -- Add slug column (alias for custom_slug)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.map ADD COLUMN slug TEXT;
    UPDATE public.map SET slug = custom_slug WHERE slug IS NULL;
  END IF;
END $$;

-- Keep both columns in sync during transition
-- Create trigger to sync title ↔ name
CREATE OR REPLACE FUNCTION public.sync_map_title_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Sync title → name
    IF NEW.title IS DISTINCT FROM OLD.title AND NEW.name IS DISTINCT FROM NEW.title THEN
      NEW.name := NEW.title;
    END IF;
    -- Sync name → title
    IF NEW.name IS DISTINCT FROM OLD.name AND NEW.title IS DISTINCT FROM NEW.name THEN
      NEW.title := NEW.name;
    END IF;
    -- Sync custom_slug → slug
    IF NEW.custom_slug IS DISTINCT FROM OLD.custom_slug AND NEW.slug IS DISTINCT FROM NEW.custom_slug THEN
      NEW.slug := NEW.custom_slug;
    END IF;
    -- Sync slug → custom_slug
    IF NEW.slug IS DISTINCT FROM OLD.slug AND NEW.custom_slug IS DISTINCT FROM NEW.slug THEN
      NEW.custom_slug := NEW.slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_map_title_name_trigger ON public.map;
CREATE TRIGGER sync_map_title_name_trigger
  BEFORE UPDATE ON public.map
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_map_title_name();

-- ============================================================================
-- STEP 7: Update member_count for all maps (ensure accuracy)
-- ============================================================================

UPDATE public.map
SET member_count = (
  SELECT COUNT(*) 
  FROM public.map_members 
  WHERE map_members.map_id = map.id
);

-- ============================================================================
-- STEP 8: Ensure all maps have at least one owner member
-- ============================================================================

-- Add any missing owners (safety check)
INSERT INTO public.map_members (map_id, account_id, role)
SELECT 
  id as map_id,
  account_id,
  'owner' as role
FROM public.map
WHERE NOT EXISTS (
  SELECT 1 FROM public.map_members 
  WHERE map_members.map_id = map.id 
  AND map_members.account_id = map.account_id
)
ON CONFLICT (map_id, account_id) DO NOTHING;

-- ============================================================================
-- STEP 9: Add created_by_account_id if it doesn't exist
-- ============================================================================

DO $$
BEGIN
  -- Add created_by_account_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'map' 
    AND column_name = 'created_by_account_id'
  ) THEN
    ALTER TABLE public.map ADD COLUMN created_by_account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT;
    -- Set it to account_id for existing maps
    UPDATE public.map SET created_by_account_id = account_id WHERE created_by_account_id IS NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 10: Validate settings structure
-- ============================================================================

-- Ensure all maps have valid settings structure
UPDATE public.map
SET settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{appearance}',
      COALESCE(settings->'appearance', '{}'::jsonb)
    ),
    '{collaboration}',
    COALESCE(settings->'collaboration', '{}'::jsonb)
  ),
  '{presentation}',
  COALESCE(settings->'presentation', '{}'::jsonb)
)
WHERE settings IS NULL 
   OR settings = '{}'::jsonb
   OR NOT (settings ? 'appearance' AND settings ? 'collaboration' AND settings ? 'presentation');

-- ============================================================================
-- STEP 11: Add indexes for new columns (if needed)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_map_name ON public.map(name) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_map_slug ON public.map(slug) WHERE slug IS NOT NULL;

-- ============================================================================
-- STEP 12: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
