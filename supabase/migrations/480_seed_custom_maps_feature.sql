-- Seed canonical custom maps feature with limits per plan
-- Aligns API/UI gating to a single slug: custom_maps

-- Create feature (idempotent)
INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'custom_maps',
  'Custom Maps',
  'Create custom maps with pins, markers, and settings',
  'maps',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Ensure plan_features rows exist with correct limits (idempotent)
WITH
  feature AS (
    SELECT id FROM billing.features WHERE slug = 'custom_maps' LIMIT 1
  ),
  plans AS (
    SELECT id, slug FROM billing.plans WHERE slug IN ('hobby', 'contributor', 'professional', 'business')
  )
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT
  p.id,
  f.id,
  CASE
    WHEN p.slug = 'hobby' THEN 3
    ELSE NULL
  END AS limit_value,
  CASE
    WHEN p.slug = 'hobby' THEN 'count'
    ELSE 'unlimited'
  END AS limit_type
FROM plans p
CROSS JOIN feature f
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  limit_value = EXCLUDED.limit_value,
  limit_type = EXCLUDED.limit_type;

NOTIFY pgrst, 'reload schema';

