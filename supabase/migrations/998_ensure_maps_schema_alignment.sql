-- Step 1: Ensure maps.maps has ALL columns from public.map
-- This script adds any missing columns to ensure perfect alignment

-- Check and add created_by_account_id
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add account_id for backward compatibility (maps.maps uses owner_account_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'maps' AND table_name = 'maps' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE maps.maps ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
    COMMENT ON COLUMN maps.maps.account_id IS 'Legacy column for migration compatibility. Use owner_account_id instead.';
  END IF;
END $$;

-- Verify all columns exist by attempting to add them (will fail silently if they exist)
-- This ensures maps.maps has every column that public.map has

-- Note: The following columns should already exist from previous migrations:
-- name, description, visibility, slug, tags, cover_image_url, image_url, 
-- is_active, auto_approve_members, membership_rules, membership_questions,
-- member_count, settings, boundary, boundary_data, published_to_community,
-- published_at, created_at, updated_at

-- If any are missing, add them:
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS auto_approve_members boolean DEFAULT false;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS membership_rules text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS membership_questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 0;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS boundary text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS boundary_data jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS published_to_community boolean DEFAULT false;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure constraints match
DO $$
BEGIN
  -- Add name constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_name_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_name_check CHECK (char_length(name) > 0);
  END IF;
  
  -- Add visibility constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_visibility_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_visibility_check 
      CHECK (visibility IN ('public', 'private', 'unlisted'));
  END IF;
  
  -- Add member_count constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_member_count_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_member_count_check CHECK (member_count >= 0);
  END IF;
END $$;

-- Create unique index on slug if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_maps_slug_unique ON maps.maps(slug) WHERE slug IS NOT NULL;
