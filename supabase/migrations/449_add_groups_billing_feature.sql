-- Add 'groups' feature to billing.features table
-- This feature enables users to create and manage groups

-- ============================================================================
-- STEP 1: Insert groups feature
-- ============================================================================

INSERT INTO billing.features (slug, name, description, category, emoji, is_active)
VALUES (
  'groups',
  'Groups',
  'Create and manage public or private groups with admin controls',
  'social',
  '👥',
  true
)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 2: Assign groups feature to plans
-- ============================================================================

-- Assign to contributor plan and above
INSERT INTO billing.plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM billing.plans p
CROSS JOIN billing.features f
WHERE p.slug IN ('contributor', 'professional', 'business')
  AND f.slug = 'groups'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- STEP 3: Update public view (if needed)
-- ============================================================================

-- The view should already include the new feature automatically
-- But we'll refresh it to be safe
DROP VIEW IF EXISTS public.billing_features;
CREATE OR REPLACE VIEW public.billing_features AS
SELECT * FROM billing.features;

GRANT SELECT ON public.billing_features TO authenticated, anon;

-- ============================================================================
-- STEP 4: Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
