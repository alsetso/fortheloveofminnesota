-- Add map_publish_to_community feature and database columns
-- Allows maps to be discoverable in community feed (Contributor+ plans)

-- ============================================================================
-- STEP 1: Add published_to_community column to map table
-- ============================================================================

ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS published_to_community BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.map
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Index for community discovery queries
CREATE INDEX IF NOT EXISTS idx_map_published_community
  ON public.map(published_to_community, is_active, created_at DESC)
  WHERE published_to_community = true AND is_active = true;

-- Comments
COMMENT ON COLUMN public.map.published_to_community IS 'Whether map is discoverable in community feed (requires map_publish_to_community feature)';
COMMENT ON COLUMN public.map.published_at IS 'Timestamp when map was published to community';

-- ============================================================================
-- STEP 2: Create billing feature
-- ============================================================================

INSERT INTO billing.features (slug, name, description, category, is_active)
VALUES (
  'map_publish_to_community',
  'Publish Map to Community',
  'Allow maps to be discoverable in the community feed',
  'maps',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 3: Add feature to plans (Contributor and up)
-- ============================================================================

WITH
  feature AS (
    SELECT id FROM billing.features WHERE slug = 'map_publish_to_community' LIMIT 1
  ),
  plans AS (
    SELECT id, slug FROM billing.plans WHERE slug IN ('contributor', 'professional', 'business')
  )
INSERT INTO billing.plan_features (plan_id, feature_id, limit_type)
SELECT
  p.id,
  f.id,
  'boolean'
FROM plans p
CROSS JOIN feature f
ON CONFLICT (plan_id, feature_id) DO UPDATE
SET limit_type = 'boolean';

-- ============================================================================
-- STEP 4: Update RLS policies to allow non-members to view private published maps
-- ============================================================================

-- Allow non-members to see private maps that are published to community
-- (for metadata/preview - content still filtered by membership via other policies)
CREATE POLICY "maps_select_private_published"
  ON public.map FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'private'
    AND is_active = true
    AND published_to_community = true
  );

-- ============================================================================
-- STEP 5: Notify PostgREST to reload schema
-- ============================================================================

NOTIFY pgrst, 'reload schema';
