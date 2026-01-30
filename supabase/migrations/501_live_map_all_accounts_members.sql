-- All accounts are members of the "live" map: backfill existing + trigger for new accounts.
-- joined_at = account.created_at for accurate counts and timestamps.

-- ============================================================================
-- STEP 1: Backfill — insert all accounts as members of the live map
-- ============================================================================

INSERT INTO public.map_members (map_id, account_id, role, joined_at)
SELECT
  live_map.id AS map_id,
  a.id AS account_id,
  'editor' AS role,
  a.created_at AS joined_at
FROM public.accounts a
CROSS JOIN LATERAL (
  SELECT id FROM public.map WHERE slug = 'live' AND is_active = true LIMIT 1
) live_map
WHERE NOT EXISTS (
  SELECT 1 FROM public.map_members mm
  WHERE mm.map_id = live_map.id AND mm.account_id = a.id
)
ON CONFLICT (map_id, account_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Update member_count on the live map
-- ============================================================================

UPDATE public.map
SET member_count = (
  SELECT COUNT(*) FROM public.map_members WHERE map_members.map_id = map.id
)
WHERE slug = 'live' AND is_active = true;

-- ============================================================================
-- STEP 3: Trigger — add new accounts to live map on INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_new_account_to_live_map()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live_map_id UUID;
BEGIN
  SELECT id INTO live_map_id FROM public.map WHERE slug = 'live' AND is_active = true LIMIT 1;
  IF live_map_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.map_members (map_id, account_id, role, joined_at)
  VALUES (live_map_id, NEW.id, 'editor', COALESCE(NEW.created_at, NOW()))
  ON CONFLICT (map_id, account_id) DO NOTHING;
  IF FOUND THEN
    UPDATE public.map SET member_count = member_count + 1 WHERE id = live_map_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_account_created_add_to_live_map ON public.accounts;
CREATE TRIGGER on_account_created_add_to_live_map
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.add_new_account_to_live_map();

COMMENT ON FUNCTION public.add_new_account_to_live_map() IS 'Adds each new account as an editor on the live map with joined_at = account.created_at; keeps live map member_count in sync.';
