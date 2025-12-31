-- Fix Executive Branch hierarchy
-- Move all departments/agencies to be children of Governor, not Executive Branch
-- Keep only the 5 core constitutional officers directly under Executive Branch

-- ============================================================================
-- STEP 1: Update all departments to be children of Governor
-- ============================================================================

UPDATE civic.orgs
SET parent_id = (
  SELECT id FROM civic.orgs WHERE slug = 'governor'
)
WHERE parent_id = (SELECT id FROM civic.orgs WHERE slug = 'executive')
  AND org_type IN ('department', 'agency')
  AND slug NOT IN ('governor', 'attorney-general', 'secretary-of-state', 'state-auditor');

-- ============================================================================
-- STEP 2: Verify the structure
-- ============================================================================

-- Executive Branch should have 5 children:
-- 1. Governor of Minnesota
-- 2. Attorney General of Minnesota  
-- 3. Secretary of State of Minnesota
-- 4. State Auditor of Minnesota
-- 5. (Lieutenant Governor is a role, not a separate org)

-- All departments should be children of Governor

-- ============================================================================
-- STEP 3: Add Lieutenant Governor as a separate org if needed
-- ============================================================================

-- Check if Lieutenant Governor org exists, if not create it
INSERT INTO civic.orgs (name, slug, org_type, parent_id)
SELECT 
  'Lieutenant Governor of Minnesota',
  'lieutenant-governor',
  'agency',
  (SELECT id FROM civic.orgs WHERE slug = 'executive')
WHERE NOT EXISTS (
  SELECT 1 FROM civic.orgs WHERE slug = 'lieutenant-governor'
);

