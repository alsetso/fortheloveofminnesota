-- Seed civic editing feature gate (UI/UX + entitlement surface)
-- Database functions already enforce subscription; this aligns UI checks to billing features.

INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'civic_edits',
  'Civic Editing',
  'Edit government directory data (orgs, people, roles) with audit logging',
  'gov',
  true
)
ON CONFLICT (slug) DO NOTHING;

WITH
  feature AS (
    SELECT id FROM billing.features WHERE slug = 'civic_edits' LIMIT 1
  ),
  plans AS (
    SELECT id, slug FROM billing.plans WHERE slug IN ('contributor', 'professional', 'business')
  )
INSERT INTO billing.plan_features (plan_id, feature_id, limit_value, limit_type)
SELECT
  p.id,
  f.id,
  1,
  'boolean'
FROM plans p
CROSS JOIN feature f
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET
  limit_value = EXCLUDED.limit_value,
  limit_type = EXCLUDED.limit_type;

NOTIFY pgrst, 'reload schema';

