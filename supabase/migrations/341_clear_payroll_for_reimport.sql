-- Clear all payroll records to allow reimport with fiscal_year
-- This will delete all existing payroll records so they can be reimported with fiscal_year populated

-- ============================================================================
-- STEP 1: Delete all payroll records
-- ============================================================================

DELETE FROM checkbook.payroll;

-- ============================================================================
-- STEP 2: Verify deletion
-- ============================================================================

-- Check count (should be 0)
-- SELECT COUNT(*) FROM checkbook.payroll;

