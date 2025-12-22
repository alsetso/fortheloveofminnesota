-- Optimize posts RLS policies for performance
-- Fixes statement timeout by optimizing user_owns_account function calls
-- The issue: RLS policy calls user_owns_account() for every row, causing timeouts

-- ============================================================================
-- STEP 1: Ensure indexes exist for optimal performance
-- ============================================================================

-- Index on accounts.user_id (should exist, but ensure it does)
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- Index on posts.account_id (helps with user_owns_account function lookups)
CREATE INDEX IF NOT EXISTS posts_account_id_idx ON public.posts(account_id);

-- Index on posts.visibility (critical for RLS policy performance)
CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts(visibility);

-- Composite index for posts visibility + account_id (helps with RLS evaluation for non-public posts)
CREATE INDEX IF NOT EXISTS posts_visibility_account_id_idx 
  ON public.posts(visibility, account_id) 
  WHERE visibility != 'public';

-- Index on posts.created_at DESC (for feed ordering)
CREATE INDEX IF NOT EXISTS posts_created_at_desc_idx 
  ON public.posts(created_at DESC);

-- Composite index: visibility + created_at (optimal for feed queries)
CREATE INDEX IF NOT EXISTS posts_visibility_created_at_idx 
  ON public.posts(visibility, created_at DESC);

-- ============================================================================
-- STEP 2: Optimize user_owns_account function with better caching
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_account(account_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get current user ID once
  current_user_id := auth.uid();
  
  -- Return false immediately if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Use index on accounts.user_id for fast lookup
  -- This query is optimized by the index created above
  RETURN EXISTS (
    SELECT 1 
    FROM public.accounts
    WHERE id = account_id 
    AND user_id = current_user_id
    LIMIT 1
  );
END;
$$;

-- Ensure function is owned by postgres (required for SECURITY DEFINER)
ALTER FUNCTION public.user_owns_account(UUID) OWNER TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_owns_account(UUID) TO authenticated, anon;

-- ============================================================================
-- STEP 3: Optimize RLS policies - check visibility first (indexed column)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "posts_select_anon" ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;

-- Anonymous: only public posts (uses visibility index)
CREATE POLICY "posts_select_anon"
  ON public.posts FOR SELECT
  TO anon
  USING (visibility = 'public'::public.post_visibility);

-- Authenticated: public posts OR own posts
-- PostgreSQL should short-circuit: if visibility='public', it won't evaluate user_owns_account
-- The composite index helps when visibility != 'public'
CREATE POLICY "posts_select_authenticated"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'::public.post_visibility 
    OR public.user_owns_account(account_id)
  );

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "posts_select_anon" ON public.posts IS 
  'Anonymous users can view public posts only. Uses visibility index for fast filtering.';

COMMENT ON POLICY "posts_select_authenticated" ON public.posts IS 
  'Authenticated users can view public posts (using visibility index) or their own posts. PostgreSQL short-circuits OR condition, so user_owns_account is only called for non-public posts.';

COMMENT ON FUNCTION public.user_owns_account(UUID) IS 
  'Checks if current user owns the account. Uses SECURITY DEFINER to bypass accounts RLS. Optimized with index on accounts.user_id.';





