-- Seed farmers-market props (market stalls + apple) + #farmers-market / #fruit tags.

insert into world.world_model_tags (slug, label, description, sort_order) values
  ('farmers-market', 'Farmers market', 'Market stalls, produce, and local-food props', 88),
  ('fruit', 'Fruit', 'Fruit and produce props', 89)
on conflict (slug) do update set
  label = excluded.label,
  description = coalesce(excluded.description, world.world_model_tags.description),
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

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
) values
  (
    'market-stalls-quaternius',
    'Market stalls',
    '/models/props/market-stalls-quaternius.glb',
    'prop',
    array['prop', 'farmers-market', 'fruit', 'structure'],
    3.5,
    1,
    0,
    true,
    129,
    true,
    true,
    true
  ),
  (
    'apple-jeremy',
    'Apple',
    '/models/props/apple-jeremy.glb',
    'prop',
    array['prop', 'fruit', 'farmers-market'],
    0.1,
    1,
    0,
    true,
    130,
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

insert into world.world_model_taggings (model_id, tag_id)
select m.id, t.id
from world.world_models m
cross join world.world_model_tags t
where (
  (m.slug = 'market-stalls-quaternius'
    and t.slug in ('prop', 'farmers-market', 'fruit', 'structure'))
  or (m.slug = 'apple-jeremy'
    and t.slug in ('prop', 'fruit', 'farmers-market'))
)
on conflict do nothing;
