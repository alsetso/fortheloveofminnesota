-- ============================================================================
-- experience_zones_featured
--
-- Adds `featured` to world.experience_zones for Discover curation.
-- Discover “Experience Zones” only surfaces featured primary zones;
-- map/radar overlays continue to list all active primary zones.
-- ============================================================================

ALTER TABLE world.experience_zones
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN world.experience_zones.featured IS
  'When true, surface this primary zone in Discover Experience Zones. Default false.';

CREATE INDEX IF NOT EXISTS experience_zones_featured_idx
  ON world.experience_zones (featured)
  WHERE featured = true AND status = 'active' AND parent_zone_id IS NULL;

-- Seed the first Discover set (match by stable slug).
UPDATE world.experience_zones
SET featured = true,
    updated_at = now()
WHERE slug IN (
  'minnesota-state-capital',
  'minnesota-state-fairgrounds',
  'msp-airport',
  'rum-river-trailhead'
)
AND parent_zone_id IS NULL;
