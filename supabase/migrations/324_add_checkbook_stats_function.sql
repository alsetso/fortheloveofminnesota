-- Add function to calculate checkbook stats for active contracts in 2026
-- This avoids fetching all rows and calculates sum/count in the database

-- ============================================================================
-- STEP 1: Create function to get checkbook stats
-- ============================================================================

CREATE OR REPLACE FUNCTION checkbook.get_active_contracts_stats_2026()
RETURNS TABLE (
  total_count BIGINT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_count,
    COALESCE(SUM(total_contract_amount), 0)::NUMERIC as total_amount
  FROM checkbook.contracts
  WHERE drill = 'Payments';
END;
$$;

-- ============================================================================
-- STEP 2: Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION checkbook.get_active_contracts_stats_2026() TO anon, authenticated;

-- ============================================================================
-- STEP 3: Create public wrapper function for Supabase client access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_checkbook_stats_2026()
RETURNS TABLE (
  total_count BIGINT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM checkbook.get_active_contracts_stats_2026();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_checkbook_stats_2026() TO anon, authenticated;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON FUNCTION checkbook.get_active_contracts_stats_2026() IS 'Returns count and sum of all contracts with drill = Payments';
COMMENT ON FUNCTION public.get_checkbook_stats_2026() IS 'Public wrapper for checkbook stats function';

