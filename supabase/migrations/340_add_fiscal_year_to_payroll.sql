-- Add fiscal_year column to payroll table
-- This identifies which fiscal year each payroll record belongs to

-- ============================================================================
-- STEP 1: Drop existing fiscal_year column if it exists (in case it was INT4)
-- ============================================================================

ALTER TABLE checkbook.payroll
DROP COLUMN IF EXISTS fiscal_year;

-- ============================================================================
-- STEP 2: Add fiscal_year column as TEXT
-- ============================================================================

ALTER TABLE checkbook.payroll
ADD COLUMN fiscal_year TEXT;

-- ============================================================================
-- STEP 3: Create index for fiscal_year
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payroll_fiscal_year ON checkbook.payroll(fiscal_year);

-- ============================================================================
-- STEP 4: Add comment
-- ============================================================================

COMMENT ON COLUMN checkbook.payroll.fiscal_year IS 'Fiscal year for this payroll record (2020-2025)';

