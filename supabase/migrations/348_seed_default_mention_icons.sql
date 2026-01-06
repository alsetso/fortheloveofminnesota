-- Seed default mention icons
-- These are placeholder icons that should be replaced with actual icon files

-- ============================================================================
-- STEP 1: Insert default mention icons
-- ============================================================================

-- Note: icon_url values are placeholders. Replace with actual Supabase storage URLs
-- or public paths after uploading icon files.

INSERT INTO public.mention_icons (slug, name, description, icon_url, is_active, display_order)
VALUES
  ('heart', 'Heart', 'Default heart icon', '/heart.png', true, 0),
  ('star', 'Star', 'Star icon', '/mention-icons/star.png', true, 1),
  ('flag', 'Flag', 'Flag icon', '/mention-icons/flag.png', true, 2),
  ('pin', 'Pin', 'Pin icon', '/mention-icons/pin.png', true, 3),
  ('marker', 'Marker', 'Marker icon', '/mention-icons/marker.png', true, 4),
  ('location', 'Location', 'Location icon', '/mention-icons/location.png', true, 5),
  ('place', 'Place', 'Place icon', '/mention-icons/place.png', true, 6),
  ('spot', 'Spot', 'Spot icon', '/mention-icons/spot.png', true, 7),
  ('point', 'Point', 'Point icon', '/mention-icons/point.png', true, 8),
  ('tag', 'Tag', 'Tag icon', '/mention-icons/tag.png', true, 9)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON TABLE public.mention_icons IS 'Default mention icons seeded. Update icon_url values after uploading actual icon files to Supabase storage or public folder.';

