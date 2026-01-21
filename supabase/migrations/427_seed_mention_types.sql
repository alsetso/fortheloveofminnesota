-- Seed mention_types table with default types
-- This populates the mention_types table with all available mention categories

-- ============================================================================
-- STEP 1: Insert mention types
-- ============================================================================

INSERT INTO public.mention_types (emoji, name) VALUES
  ('🗣', 'Community & Social'),
  ('💬', 'Stories & moments'),
  ('📸', 'Photos & videos'),
  ('❤️', 'Local shoutouts'),
  ('🤝', 'Meetups & gatherings'),
  ('🧭', 'Tips & recommendations'),
  ('🐕', 'Lost & found (pets/items)'),
  ('🚨', 'Neighborhood alerts'),
  ('⭐', 'Reviews'),
  ('🏷', 'Things for sale'),
  ('🏠', 'Listings & rentals'),
  ('💼', 'Job postings'),
  ('🆕', 'New businesses'),
  ('❌', 'Closures & changes'),
  ('🛍', 'Pop-ups & markets'),
  ('🧾', 'Services offered'),
  ('📅', 'Events & festivals'),
  ('🎶', 'Live music'),
  ('🏟', 'Sports & games'),
  ('🎭', 'Arts & performances'),
  ('🌽', 'Farmers markets'),
  ('🧺', 'Community sales'),
  ('🎟', 'Ticketed events'),
  ('🌲', 'Parks & trails'),
  ('🏕', 'Campgrounds'),
  ('🚶', 'Hiking spots'),
  ('🚣', 'Lakes & rivers'),
  ('🎣', 'Fishing reports'),
  ('❄️', 'Ice & snow conditions'),
  ('🌤', 'Weather impacts'),
  ('🚧', 'Construction updates'),
  ('🏗', 'Development progress'),
  ('🛣', 'Road conditions'),
  ('🚦', 'Traffic issues'),
  ('🏘', 'Zoning changes'),
  ('🏡', 'Open houses'),
  ('📍', 'Before & after photos'),
  ('🏛', 'Town halls & meetings'),
  ('🗳', 'Voting locations'),
  ('📢', 'Public notices'),
  ('💰', 'Spending observations'),
  ('📊', 'Transparency updates'),
  ('⚖️', 'Policy impacts'),
  ('🏢', 'Government buildings'),
  ('🙋', 'Volunteer opportunities'),
  ('🎁', 'Donations & fundraisers'),
  ('🤲', 'Mutual aid'),
  ('🚗', 'Ride shares'),
  ('🩺', 'Community assistance'),
  ('🆘', 'Emergency info')
ON CONFLICT (emoji) DO NOTHING;

-- ============================================================================
-- STEP 2: Add comment
-- ============================================================================

COMMENT ON TABLE public.mention_types IS 'Mention type categories seeded with default types. Use service_role to add/modify types.';
