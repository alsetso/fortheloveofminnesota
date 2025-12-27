-- Backfill accounts table for existing users in auth.users
-- Creates account records for all users who don't have one yet

-- ============================================================================
-- STEP 1: Create accounts for existing users
-- ============================================================================

INSERT INTO public.accounts (user_id, role, last_visit, created_at)
SELECT 
  u.id AS user_id,
  'general'::public.account_role AS role,
  COALESCE(u.last_sign_in_at, u.created_at, NOW()) AS last_visit,
  COALESCE(u.created_at, NOW()) AS created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.accounts a 
  WHERE a.user_id = u.id
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 2: Report results
-- ============================================================================

DO $$
DECLARE
  created_count INTEGER;
  total_users INTEGER;
  accounts_with_users INTEGER;
BEGIN
  -- Count how many accounts were created
  SELECT COUNT(*) INTO created_count
  FROM public.accounts
  WHERE created_at >= NOW() - INTERVAL '1 minute';
  
  -- Count total users
  SELECT COUNT(*) INTO total_users
  FROM auth.users;
  
  -- Count accounts with user_id
  SELECT COUNT(*) INTO accounts_with_users
  FROM public.accounts
  WHERE user_id IS NOT NULL;
  
  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  - Total users in auth.users: %', total_users;
  RAISE NOTICE '  - Total accounts with user_id: %', accounts_with_users;
  RAISE NOTICE '  - Accounts created in this migration: %', created_count;
  
  IF accounts_with_users < total_users THEN
    RAISE WARNING 'Some users still do not have accounts. This may indicate users created after this migration ran.';
  END IF;
END $$;




