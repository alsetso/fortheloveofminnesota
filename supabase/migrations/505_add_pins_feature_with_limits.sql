-- Add pins feature with count limits per plan
-- Contributor plan: 1000 pins
-- Other plans: TBD (can be updated later)

-- Create feature (idempotent)
INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'pins',
  'Pins',
  'Maximum number of pins you can create',
  'content',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Ensure plan_features rows exist with correct limits (idempotent)
WITH
  feature AS (
    SELECT id FROM billing.features WHERE slug = 'pins' LIMIT 1
  ),
  plans AS (
    SELECT id, slug FROM billing.plans WHERE slug IN ('hobby', 'contributor', 'plus', 'professional', 'business', 'gov')
  )
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT
  p.id,
  f.id,
  CASE
    WHEN p.slug = 'hobby' THEN 50
    WHEN p.slug = 'contributor' THEN 1000
    WHEN p.slug = 'plus' THEN 1000
    WHEN p.slug = 'professional' THEN 5000
    WHEN p.slug = 'business' THEN NULL  -- Unlimited
    WHEN p.slug = 'gov' THEN NULL  -- Unlimited
    ELSE 50  -- Default for any other plans
  END AS limit_value,
  CASE
    WHEN p.slug = 'business' OR p.slug = 'gov' THEN 'unlimited'
    ELSE 'count'
  END AS limit_type
FROM plans p
CROSS JOIN feature f
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  limit_value = EXCLUDED.limit_value,
  limit_type = EXCLUDED.limit_type;

NOTIFY pgrst, 'reload schema';
