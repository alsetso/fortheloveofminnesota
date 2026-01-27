-- Add map_members feature with count limits per plan
-- Allows map owners to limit member count, with plan-based maximums

-- Create feature (idempotent)
INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'map_members',
  'Map Members',
  'Maximum number of members allowed on a map',
  'maps',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Ensure plan_features rows exist with correct limits (idempotent)
WITH
  feature AS (
    SELECT id FROM billing.features WHERE slug = 'map_members' LIMIT 1
  ),
  plans AS (
    SELECT id, slug FROM billing.plans WHERE slug IN ('hobby', 'contributor', 'professional', 'business')
  )
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT
  p.id,
  f.id,
  CASE
    WHEN p.slug = 'hobby' THEN 10
    WHEN p.slug = 'contributor' THEN 50
    WHEN p.slug = 'professional' THEN 200
    WHEN p.slug = 'business' THEN NULL  -- Unlimited
  END AS limit_value,
  CASE
    WHEN p.slug = 'business' THEN 'unlimited'
    ELSE 'count'
  END AS limit_type
FROM plans p
CROSS JOIN feature f
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  limit_value = EXCLUDED.limit_value,
  limit_type = EXCLUDED.limit_type;

NOTIFY pgrst, 'reload schema';
