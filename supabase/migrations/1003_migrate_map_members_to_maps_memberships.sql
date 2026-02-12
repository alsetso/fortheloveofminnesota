-- Migrate public.map_members → maps.memberships
-- Maps roles: owner/manager/editor → owner/contributor/viewer

-- ============================================================================
-- STEP 1: Ensure maps.memberships has all columns
-- ============================================================================

-- Columns should already exist, but ensure they're there
ALTER TABLE maps.memberships ADD COLUMN IF NOT EXISTS map_id uuid REFERENCES maps.maps(id) ON DELETE CASCADE;
ALTER TABLE maps.memberships ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;
ALTER TABLE maps.memberships ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer';
ALTER TABLE maps.memberships ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

-- ============================================================================
-- STEP 2: Migrate data with role mapping
-- ============================================================================

INSERT INTO maps.memberships (
  map_id,
  account_id,
  role,
  joined_at
)
SELECT 
  map_id,
  account_id,
  CASE 
    WHEN role = 'owner' THEN 'owner'
    WHEN role = 'manager' THEN 'contributor' -- manager → contributor
    WHEN role = 'editor' THEN 'contributor'  -- editor → contributor
    ELSE 'viewer'
  END as role,
  joined_at
FROM public.map_members
WHERE map_id IN (SELECT id FROM maps.maps) -- Only migrate memberships for maps that exist in maps.maps
ON CONFLICT (map_id, account_id) DO UPDATE SET
  role = EXCLUDED.role,
  joined_at = EXCLUDED.joined_at;

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  public_count INTEGER;
  maps_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM public.map_members;
  SELECT COUNT(*) INTO maps_count FROM maps.memberships;
  
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE '  public.map_members rows: %', public_count;
  RAISE NOTICE '  maps.memberships rows: %', maps_count;
  
  IF maps_count >= public_count THEN
    RAISE NOTICE '✅ Migration successful! All rows migrated.';
  ELSE
    RAISE WARNING '⚠️  Migration incomplete. Missing % rows.', public_count - maps_count;
  END IF;
END $$;
