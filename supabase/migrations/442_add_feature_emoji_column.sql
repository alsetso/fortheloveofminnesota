-- Add emoji column to billing.features table
-- Assign emojis to all existing features

-- ============================================================================
-- Add emoji column
-- ============================================================================

ALTER TABLE billing.features
ADD COLUMN IF NOT EXISTS emoji TEXT;

-- ============================================================================
-- Update public view to include emoji
-- ============================================================================

DROP VIEW IF EXISTS public.billing_features;
CREATE OR REPLACE VIEW public.billing_features AS
SELECT * FROM billing.features;

GRANT SELECT ON public.billing_features TO authenticated, anon;

-- ============================================================================
-- Assign emojis to existing features
-- ============================================================================

UPDATE billing.features SET emoji = '🗺️' WHERE slug = 'unlimited_maps';
UPDATE billing.features SET emoji = '📊' WHERE slug = 'visitor_analytics';
UPDATE billing.features SET emoji = '👥' WHERE slug = 'visitor_identities';
UPDATE billing.features SET emoji = '📈' WHERE slug = 'time_series_charts';
UPDATE billing.features SET emoji = '💾' WHERE slug = 'export_data';
UPDATE billing.features SET emoji = '🌍' WHERE slug = 'geographic_data';
UPDATE billing.features SET emoji = '🔗' WHERE slug = 'referrer_tracking';
UPDATE billing.features SET emoji = '⚡' WHERE slug = 'real_time_updates';
UPDATE billing.features SET emoji = '📜' WHERE slug = 'all_time_historical_data';
UPDATE billing.features SET emoji = '📝' WHERE slug = 'extended_text';
UPDATE billing.features SET emoji = '🎥' WHERE slug = 'video_uploads';
UPDATE billing.features SET emoji = '📚' WHERE slug = 'unlimited_collections';
UPDATE billing.features SET emoji = '⭐' WHERE slug = 'gold_profile_border';
UPDATE billing.features SET emoji = '🎨' WHERE slug = 'advanced_profile_features';

-- ============================================================================
-- Force PostgREST schema cache refresh
-- ============================================================================

NOTIFY pgrst, 'reload schema';
