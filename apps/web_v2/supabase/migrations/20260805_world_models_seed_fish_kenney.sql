-- Seed Kenney fish prop into world.world_models.
insert into world.world_models (
  slug,
  name,
  file_path,
  category,
  categories,
  real_world_meters,
  native_units_max,
  default_height_meters,
  active,
  sort_order,
  allow_user_scale,
  allow_user_reposition,
  allow_user_rotation
) values (
  'fish-kenney',
  'Fish',
  '/models/props/fish-kenney.glb',
  'animal',
  array['animal', 'wildlife', 'prop'],
  0.35,
  1,
  0,
  true,
  125,
  true,
  true,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  file_path = excluded.file_path,
  category = excluded.category,
  categories = excluded.categories,
  real_world_meters = excluded.real_world_meters,
  native_units_max = excluded.native_units_max,
  active = excluded.active,
  sort_order = excluded.sort_order,
  allow_user_scale = excluded.allow_user_scale,
  updated_at = now();
