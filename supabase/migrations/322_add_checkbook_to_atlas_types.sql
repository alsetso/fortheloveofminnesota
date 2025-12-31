-- Add checkbook to atlas_types table
-- Checkbook represents government contract and financial data

-- ============================================================================
-- STEP 1: Insert checkbook into atlas_types
-- ============================================================================

INSERT INTO atlas.atlas_types (
  slug,
  name,
  description,
  icon_path,
  is_visible,
  status,
  display_order
) VALUES (
  'checkbook',
  'Checkbook',
  'Government contracts and financial transactions',
  '/checkbook.png',
  true,
  'active',
  100
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_path = EXCLUDED.icon_path,
  is_visible = EXCLUDED.is_visible,
  status = EXCLUDED.status,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: Verification
-- ============================================================================

DO $$
DECLARE
  v_checkbook_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM atlas.atlas_types WHERE slug = 'checkbook'
  ) INTO v_checkbook_exists;
  
  IF v_checkbook_exists THEN
    RAISE NOTICE 'Checkbook atlas type added successfully';
  ELSE
    RAISE EXCEPTION 'Failed to add checkbook atlas type';
  END IF;
END;
$$;

