-- Migration: Align maps.maps with public.map and migrate data
-- This ensures both tables have the same fields and migrates all data

-- Step 1: Ensure maps.maps has all columns from public.map
-- Add created_by_account_id if it doesn't exist (for tracking original creator)
ALTER TABLE maps.maps ADD COLUMN IF NOT EXISTS created_by_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add account_id column temporarily for migration compatibility
-- (maps.maps uses owner_account_id, but public.map uses account_id)
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

-- Step 2: Migrate data from public.map to maps.maps
-- Map account_id → owner_account_id (use created_by_account_id as fallback)
INSERT INTO maps.maps (
  id,
  owner_account_id,
  created_by_account_id,
  account_id, -- temporary for migration
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
ON CONFLICT (id) DO NOTHING;

-- Step 3: Create a mapping table to track migration (optional, for verification)
CREATE TABLE IF NOT EXISTS maps._migration_map_ids (
  public_map_id uuid PRIMARY KEY,
  maps_map_id uuid NOT NULL,
  migrated_at timestamptz DEFAULT now()
);

-- Store the mapping
INSERT INTO maps._migration_map_ids (public_map_id, maps_map_id)
SELECT id, id FROM public.map
ON CONFLICT (public_map_id) DO NOTHING;

-- Step 4: Verify migration
DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map;
  SELECT COUNT(*) INTO maps_count FROM maps.maps;
  
  RAISE NOTICE 'Migration complete: public.map has % rows, maps.maps has % rows', public_count, maps_count;
  
  IF maps_count < public_count THEN
    RAISE WARNING 'Not all rows migrated! public.map: %, maps.maps: %', public_count, maps_count;
  END IF;
END $$;
