-- Seed world.world_models from shared/3d-models/props catalog.
-- file_path is the public app URL after sync-3d-models.sh.

insert into world.world_models (
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
  active,
  sort_order
)
values
  ('wooden-sign-ipoly3d', 'Wooden sign', '/models/props/wooden-sign-ipoly3d.glb', 'prop', array['prop','sign'], 1.2, 1, 0, 0, true, true, false, true, true, 10),
  ('coin-quaternius', 'Coin', '/models/props/coin-quaternius.glb', 'prop', array['prop','collectible'], 0.35, 1, 0, 0, true, true, false, true, true, 20),
  ('flag-quaternius', 'Flag', '/models/props/flag-quaternius.glb', 'prop', array['prop','civic'], 2.0, 1, 0, 0, true, true, false, true, true, 30),
  ('billboard-poly', 'Billboard', '/models/props/billboard-poly.glb', 'prop', array['prop','signage'], 4.0, 1, 0, 0, true, true, false, true, true, 40),
  ('tree-quaternius', 'Tree', '/models/props/tree-quaternius.glb', 'prop', array['prop','nature'], 5.0, 1, 0, 0, true, true, false, true, true, 50),
  ('cow-poly', 'Cow', '/models/props/cow-poly.glb', 'prop', array['prop','wildlife'], 2.2, 1, 0, 0, true, true, false, true, true, 60),
  ('chicken-jeremy', 'Chicken', '/models/props/chicken-jeremy.glb', 'prop', array['prop','wildlife'], 0.4, 1, 0, 0, true, true, false, true, true, 70),
  ('chicken-coop-quaternius', 'Chicken coop', '/models/props/chicken-coop-quaternius.glb', 'prop', array['prop','structure'], 2.5, 1, 0, 0, true, true, false, true, true, 80),
  ('cat-poly', 'Cat', '/models/props/cat-poly.glb', 'prop', array['prop','wildlife'], 0.45, 1, 0, 0, true, true, false, true, true, 90),
  ('beagle-poly', 'Beagle', '/models/props/beagle-poly.glb', 'prop', array['prop','wildlife'], 0.55, 1, 0, 0, true, true, false, true, true, 100),
  ('fox-poly', 'Fox', '/models/props/fox-poly.glb', 'prop', array['prop','wildlife'], 0.7, 1, 0, 0, true, true, false, true, true, 110),
  ('treasure-chest-safayan', 'Treasure chest', '/models/props/treasure-chest-safayan.glb', 'prop', array['prop','collectible'], 0.9, 1, 0, 0, true, true, false, true, true, 120)
on conflict (slug) do update set
  name = excluded.name,
  file_path = excluded.file_path,
  category = excluded.category,
  categories = excluded.categories,
  real_world_meters = excluded.real_world_meters,
  native_units_max = excluded.native_units_max,
  allow_user_scale = excluded.allow_user_scale,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();
