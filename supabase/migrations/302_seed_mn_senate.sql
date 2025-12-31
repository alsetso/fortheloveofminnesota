-- Seed Minnesota Senate members
-- Generated from senate.md

-- ============================================================================
-- STEP 1: Insert senators into people table
-- ============================================================================

-- ============================================================================
-- STEP 2: Create roles for senators
-- ============================================================================

-- First, ensure Minnesota Senate org exists
INSERT INTO civic.orgs (name, slug, org_type, parent_id)
SELECT 'Minnesota Senate', 'mn-senate', 'agency',
  (SELECT id FROM civic.orgs WHERE slug = 'legislative')
WHERE NOT EXISTS (SELECT 1 FROM civic.orgs WHERE slug = 'mn-senate');

-- Create roles for each senator