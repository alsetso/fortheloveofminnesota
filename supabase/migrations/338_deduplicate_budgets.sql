-- Deduplicate budgets table and add unique constraint
-- Removes duplicate records based on all data columns

-- ============================================================================
-- STEP 1: Identify and remove duplicates
-- Keep the record with the earliest created_at for each duplicate group
-- ============================================================================

DELETE FROM checkbook.budgets
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY 
               budget_period,
               COALESCE(agency, ''),
               COALESCE(fund, ''),
               COALESCE(program, ''),
               COALESCE(activity, ''),
               available_amount,
               obligated_amount,
               spend_amount,
               remaining_amount,
               budget_amount,
               budget_remaining_amount
             ORDER BY created_at ASC
           ) as rn
    FROM checkbook.budgets
  ) t
  WHERE rn > 1
);

-- ============================================================================
-- STEP 2: Add unique constraint to prevent future duplicates
-- ============================================================================

-- Create unique index on all data columns (excluding id and timestamps)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_unique_record
ON checkbook.budgets (
  budget_period,
  COALESCE(agency, ''),
  COALESCE(fund, ''),
  COALESCE(program, ''),
  COALESCE(activity, ''),
  available_amount,
  obligated_amount,
  spend_amount,
  remaining_amount,
  budget_amount,
  budget_remaining_amount
);

-- ============================================================================
-- STEP 3: Add comment
-- ============================================================================

COMMENT ON INDEX idx_budgets_unique_record IS 
  'Prevents duplicate budget records based on all data columns';

