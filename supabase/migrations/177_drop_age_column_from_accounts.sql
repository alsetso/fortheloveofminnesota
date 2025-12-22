-- Drop age column from accounts table
-- Age is no longer required for user accounts

-- ============================================================================
-- STEP 1: Drop age column
-- ============================================================================

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS age;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON TABLE public.accounts IS 
  'User account table. Age column has been removed.';






