-- ============================================================================
-- Community post world models — seed 5 auto-placement models (one per category).
-- Slugs are permanent. GLBs are temporary stand-ins until custom art ships.
-- interaction='info' so taps open the PostDetailCard, never a claim flow.
-- ============================================================================

INSERT INTO world.world_models (
  slug,
  name,
  file_path,
  category,
  categories,
  real_world_meters,
  native_units_max,
  default_height_meters,
  default_rotation_z,
  allow_user_reposition,
  allow_user_rotation,
  allow_user_height,
  allow_user_scale,
  interaction,
  on_collect,
  purpose,
  player_placeable,
  active,
  sort_order
)
VALUES
  ('community-report',    'Community Report',    '/models/construction-sign.glb', 'prop', ARRAY['prop','community'], 1.0, 1, 0, 0, false, false, false, false, 'info', 'stay', 'social', false, true, 1000),
  ('community-highlight', 'Community Highlight', '/models/flag.glb',              'prop', ARRAY['prop','community'], 2.0, 1, 0, 0, false, false, false, false, 'info', 'stay', 'social', false, true, 1001),
  ('community-event',     'Community Event',     '/models/note.glb',              'prop', ARRAY['prop','community'], 0.5, 1, 0, 0, false, false, false, false, 'info', 'stay', 'social', false, true, 1002),
  ('community-story',     'Community Story',     '/models/share.glb',             'prop', ARRAY['prop','community'], 0.8, 1, 0, 0, false, false, false, false, 'info', 'stay', 'social', false, true, 1003),
  ('community-idea',      'Community Idea',      '/models/cone.glb',              'prop', ARRAY['prop','community'], 0.6, 1, 0, 0, false, false, false, false, 'info', 'stay', 'social', false, true, 1004)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  file_path   = EXCLUDED.file_path,
  category    = EXCLUDED.category,
  categories  = EXCLUDED.categories,
  interaction = EXCLUDED.interaction,
  purpose     = EXCLUDED.purpose,
  active      = EXCLUDED.active,
  updated_at  = now();
