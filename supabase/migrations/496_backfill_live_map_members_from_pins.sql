-- Backfill map_members for accounts that have pins on the "live" map
-- Sets joined_at to the account's created_at timestamp to simulate historical membership

-- ============================================================================
-- STEP 1: Insert map_members for accounts with pins on "live" map
-- ============================================================================

INSERT INTO public.map_members (map_id, account_id, role, joined_at)
SELECT DISTINCT
  live_map.id AS map_id,
  mp.account_id,
  'editor' AS role,
  a.created_at AS joined_at
FROM public.map_pins mp
INNER JOIN public.map live_map ON live_map.id = mp.map_id
INNER JOIN public.accounts a ON a.id = mp.account_id
WHERE 
  live_map.slug = 'live'
  AND live_map.is_active = true
  AND mp.account_id IS NOT NULL
  AND NOT EXISTS (
    -- Skip if already a member
    SELECT 1 FROM public.map_members mm
    WHERE mm.map_id = live_map.id
    AND mm.account_id = mp.account_id
  )
ON CONFLICT (map_id, account_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Update member_count on the live map
-- ============================================================================

UPDATE public.map
SET member_count = (
  SELECT COUNT(*) 
  FROM public.map_members 
  WHERE map_members.map_id = map.id
)
WHERE slug = 'live' AND is_active = true;

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON TABLE public.map_members IS 'Membership and role management for maps. This migration backfilled members from map_pins on the "live" map, setting joined_at to account.created_at for historical accuracy.';
