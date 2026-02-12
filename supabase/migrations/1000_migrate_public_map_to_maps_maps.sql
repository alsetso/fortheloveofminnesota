-- Comprehensive migration: Align schemas and migrate public.map → maps.maps
-- This ensures both tables have identical fields and migrates all data

-- ============================================================================
-- STEP 1: Ensure maps.maps has ALL columns from public.map
-- ============================================================================

-- Core identity columns
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Basic info (should already exist, but ensure they're there)
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS slug text;

-- Media & appearance
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS image_url text;

-- Status & membership
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS auto_approve_members boolean DEFAULT false;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS membership_rules text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS membership_questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 0;

-- Settings & boundaries
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS boundary text;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS boundary_data jsonb;

-- Publishing
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS published_to_community boolean DEFAULT false;
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Timestamps
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================================
-- STEP 2: Ensure constraints match public.map
-- ============================================================================

DO $$
BEGIN
  -- Name constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_name_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_name_check CHECK (char_length(name) > 0);
  END IF;
  
  -- Visibility constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_visibility_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_visibility_check 
      CHECK (visibility IN ('public', 'private', 'unlisted'));
  END IF;
  
  -- Member count constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'maps.maps'::regclass 
    AND conname = 'maps_member_count_check'
  ) THEN
    ALTER TABLE maps.maps ADD CONSTRAINT maps_member_count_check CHECK (member_count >= 0);
  END IF;
END $$;

-- Unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_maps_slug_unique ON maps.maps(slug) WHERE slug IS NOT NULL;

-- ============================================================================
-- STEP 3: Migrate data from public.map to maps.maps
-- ============================================================================

INSERT INTO maps.maps (
  id,
  owner_account_id,
  created_by_account_id,
  account_id, -- temporary for compatibility
  name,
  description,
  visibility,
  slug,
  tags,
  cover_image_url,
  image_url,
  is_active,
  auto_approve_members,
  membership_rules,
  membership_questions,
  member_count,
  settings,
  boundary,
  boundary_data,
  published_to_community,
  published_at,
  created_at,
  updated_at
)
SELECT 
  id,
  COALESCE(account_id, created_by_account_id) as owner_account_id,
  created_by_account_id,
  COALESCE(account_id, created_by_account_id) as account_id,
  name,
  description,
  visibility,
  slug,
  tags,
  cover_image_url,
  image_url,
  is_active,
  auto_approve_members,
  membership_rules,
  membership_questions,
  member_count,
  settings,
  boundary,
  boundary_data,
  published_to_community,
  published_at,
  created_at,
  updated_at
FROM public.map
WHERE id NOT IN (SELECT id FROM maps.maps) -- Avoid duplicates
ON CONFLICT (id) DO UPDATE SET
  owner_account_id = EXCLUDED.owner_account_id,
  created_by_account_id = EXCLUDED.created_by_account_id,
  account_id = EXCLUDED.account_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  visibility = EXCLUDED.visibility,
  slug = EXCLUDED.slug,
  tags = EXCLUDED.tags,
  cover_image_url = EXCLUDED.cover_image_url,
  image_url = EXCLUDED.image_url,
  is_active = EXCLUDED.is_active,
  auto_approve_members = EXCLUDED.auto_approve_members,
  membership_rules = EXCLUDED.membership_rules,
  membership_questions = EXCLUDED.membership_questions,
  member_count = EXCLUDED.member_count,
  settings = EXCLUDED.settings,
  boundary = EXCLUDED.boundary,
  boundary_data = EXCLUDED.boundary_data,
  published_to_community = EXCLUDED.published_to_community,
  published_at = EXCLUDED.published_at,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map;
  SELECT COUNT(*) INTO maps_count FROM maps.maps;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map rows: %', public_count;
  RAISE NOTICE '  maps.maps rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
