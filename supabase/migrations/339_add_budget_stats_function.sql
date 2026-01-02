-- Add function to calculate budget stats by period
-- This avoids fetching all rows and calculates sums in the database

-- ============================================================================
-- STEP 1: Create function to get budget stats by period
-- ============================================================================

CREATE OR REPLACE FUNCTION checkbook.get_budget_stats(p_period INTEGER DEFAULT NULL)
RETURNS TABLE (
  total_budget NUMERIC,
  total_spend NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(budget_amount), 0)::NUMERIC as total_budget,
    COALESCE(SUM(spend_amount), 0)::NUMERIC as total_spend
  FROM checkbook.budgets
  WHERE (p_period IS NULL OR budget_period = p_period);
END;
$$;

-- ============================================================================
-- STEP 2: Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION checkbook.get_budget_stats(INTEGER) TO anon, authenticated;

-- ============================================================================
-- STEP 3: Create public wrapper function for Supabase client access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_budget_stats(p_period INTEGER DEFAULT NULL)
RETURNS TABLE (
  total_budget NUMERIC,
  total_spend NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM checkbook.get_budget_stats(p_period);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_stats(INTEGER) TO anon, authenticated;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON FUNCTION checkbook.get_budget_stats(INTEGER) IS 'Returns sum of budget_amount and spend_amount for a given period (NULL = all periods)';
COMMENT ON FUNCTION public.get_budget_stats(INTEGER) IS 'Public wrapper for budget stats function';

