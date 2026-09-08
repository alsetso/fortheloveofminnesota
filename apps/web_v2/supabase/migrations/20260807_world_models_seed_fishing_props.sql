-- Seed fishing props (lure + pole) + #fishing tag.
-- Also tag existing fish-kenney with #fishing.

insert into world.world_model_tags (slug, label, description, sort_order) values
  ('fishing', 'Fishing', 'Rods, lures, fish, and lake-life props', 85)
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
    'lure-quaternius',
    'Lure',
    '/models/props/lure-quaternius.glb',
    'prop',
    array['prop', 'fishing', 'water', 'sport'],
    0.12,
    1,
    0,
    true,
    127,
    true,
    true,
    true
  ),
  (
    'fishing-pole-westphal',
    'Fishing pole',
    '/models/props/fishing-pole-westphal.glb',
    'prop',
    array['prop', 'fishing', 'water', 'sport'],
    1.8,
    1,
    0,
    true,
    128,
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

-- Link fishing props + fish to tags.
insert into world.world_model_taggings (model_id, tag_id)
select m.id, t.id
from world.world_models m
cross join world.world_model_tags t
where m.slug in ('lure-quaternius', 'fishing-pole-westphal', 'fish-kenney')
  and (
    (m.slug in ('lure-quaternius', 'fishing-pole-westphal')
      and t.slug in ('prop', 'fishing', 'water', 'sport'))
    or (m.slug = 'fish-kenney'
      and t.slug in ('fishing', 'animal', 'wildlife', 'prop', 'water'))
  )
on conflict do nothing;
