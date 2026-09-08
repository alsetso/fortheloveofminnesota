-- World model tags (batch findability) + graduation-cap-poly seed.
-- Soft `categories text[]` remains; this is the canonical tag dictionary + M2M.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists world.world_model_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_model_tags_slug_unique unique (slug),
  constraint world_model_tags_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table world.world_model_tags is
  'Canonical hashtags for world 3D models (e.g. school → #school).';
comment on column world.world_model_tags.slug is
  'URL/hashtag slug without leading # (school, wildlife, vehicle).';

create table if not exists world.world_model_taggings (
  model_id uuid not null references world.world_models (id) on delete cascade,
  tag_id uuid not null references world.world_model_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (model_id, tag_id)
);

comment on table world.world_model_taggings is
  'Many-to-many: world_models ↔ world_model_tags.';

create index if not exists world_model_taggings_tag_id_idx
  on world.world_model_taggings (tag_id);
create index if not exists world_model_taggings_model_id_idx
  on world.world_model_taggings (model_id);
create index if not exists world_model_tags_active_sort_idx
  on world.world_model_tags (active, sort_order, slug);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table world.world_model_tags enable row level security;
alter table world.world_model_taggings enable row level security;

drop policy if exists world_model_tags_public_read on world.world_model_tags;
create policy world_model_tags_public_read
  on world.world_model_tags
  for select
  to anon, authenticated
  using (active is true);

drop policy if exists world_model_tags_admin_write on world.world_model_tags;
create policy world_model_tags_admin_write
  on world.world_model_tags
  for all
  to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.user_id = auth.uid() and a.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
      where a.user_id = auth.uid() and a.role = 'admin'
    )
  );

drop policy if exists world_model_taggings_public_read on world.world_model_taggings;
create policy world_model_taggings_public_read
  on world.world_model_taggings
  for select
  to anon, authenticated
  using (true);

drop policy if exists world_model_taggings_admin_write on world.world_model_taggings;
create policy world_model_taggings_admin_write
  on world.world_model_taggings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.user_id = auth.uid() and a.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
      where a.user_id = auth.uid() and a.role = 'admin'
    )
  );

grant select on world.world_model_tags to anon, authenticated;
grant select on world.world_model_taggings to anon, authenticated;
grant insert, update, delete on world.world_model_tags to authenticated;
grant insert, update, delete on world.world_model_taggings to authenticated;

-- ---------------------------------------------------------------------------
-- Seed core tags + backfill from existing categories
-- ---------------------------------------------------------------------------

insert into world.world_model_tags (slug, label, description, sort_order) values
  ('school', 'School', 'Schools, campuses, education props', 10),
  ('prop', 'Prop', 'Droppable map props', 20),
  ('vehicle', 'Vehicle', 'Cars, trucks, buses', 30),
  ('animal', 'Animal', 'Wildlife and pets', 40),
  ('wildlife', 'Wildlife', 'Nature animals', 45),
  ('character', 'Character', 'People / characters', 50),
  ('sign', 'Sign', 'Signs and markers', 60),
  ('signage', 'Signage', 'Billboards and display signs', 65),
  ('building', 'Building', 'Structures and buildings', 70),
  ('structure', 'Structure', 'Built props (coops, docks, etc.)', 75),
  ('water', 'Water', 'Boats and watercraft', 80),
  ('air', 'Air', 'Aircraft', 90),
  ('sport', 'Sport', 'Sports equipment', 100),
  ('collectible', 'Collectible', 'Coins, chests, rewards', 110),
  ('civic', 'Civic', 'Flags and civic markers', 120),
  ('nature', 'Nature', 'Trees and natural props', 130),
  ('education', 'Education', 'Graduation / learning', 15)
on conflict (slug) do update set
  label = excluded.label,
  description = coalesce(excluded.description, world.world_model_tags.description),
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

-- Ensure every distinct categories[] / category value exists as a tag.
insert into world.world_model_tags (slug, label, sort_order)
select distinct
  lower(c.slug) as slug,
  initcap(replace(lower(c.slug), '-', ' ')) as label,
  500
from (
  select unnest(coalesce(m.categories, '{}'::text[])) as slug
  from world.world_models m
  union
  select m.category as slug
  from world.world_models m
  where m.category is not null and length(trim(m.category)) > 0
) c
where c.slug is not null
  and length(trim(c.slug)) > 0
  and lower(c.slug) ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
on conflict (slug) do nothing;

-- Link models to tags from category + categories[].
insert into world.world_model_taggings (model_id, tag_id)
select distinct m.id, t.id
from world.world_models m
cross join lateral (
  select unnest(
    array_remove(
      array_cat(
        coalesce(m.categories, '{}'::text[]),
        case
          when m.category is not null and length(trim(m.category)) > 0
            then array[m.category]
          else '{}'::text[]
        end
      ),
      null
    )
  ) as slug
) s
join world.world_model_tags t on t.slug = lower(trim(s.slug))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seed graduation cap (Poly by Google)
-- ---------------------------------------------------------------------------

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
  'graduation-cap-poly',
  'Graduation cap',
  '/models/props/graduation-cap-poly.glb',
  'prop',
  array['prop', 'school', 'education', 'civic'],
  0.28,
  1,
  0,
  true,
  126,
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

-- Tag graduation cap + schoolbus with #school / #education.
insert into world.world_model_taggings (model_id, tag_id)
select m.id, t.id
from world.world_models m
cross join world.world_model_tags t
where m.slug in ('graduation-cap-poly', 'schoolbus')
  and t.slug in ('school', 'education', 'prop', 'civic', 'vehicle')
  and (
    (m.slug = 'graduation-cap-poly' and t.slug in ('school', 'education', 'prop', 'civic'))
    or (m.slug = 'schoolbus' and t.slug in ('school', 'education', 'vehicle'))
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RPC: expose tags[] on catalog list
-- ---------------------------------------------------------------------------

drop function if exists public.world_list_models(boolean);

create or replace function public.world_list_models(
  p_active_only boolean default false
)
returns table (
  id uuid,
  slug text,
  name text,
  file_path text,
  category text,
  tags text[],
  active boolean,
  sort_order integer,
  real_world_meters numeric,
  native_units_max numeric,
  default_rotation_z numeric,
  allow_user_scale boolean
)
language sql
stable
security invoker
set search_path = public, world
as $$
  select
    m.id,
    m.slug,
    m.name,
    m.file_path,
    m.category,
    coalesce(
      (
        select array_agg(t.slug order by t.sort_order, t.slug)
        from world.world_model_taggings mt
        join world.world_model_tags t on t.id = mt.tag_id
        where mt.model_id = m.id
          and t.active is true
      ),
      '{}'::text[]
    ) as tags,
    m.active,
    m.sort_order,
    m.real_world_meters,
    m.native_units_max,
    m.default_rotation_z,
    m.allow_user_scale
  from world.world_models m
  where (not p_active_only) or m.active is true
  order by m.active desc, m.sort_order nulls last, m.name;
$$;

revoke all on function public.world_list_models(boolean) from public;
grant execute on function public.world_list_models(boolean) to anon;
grant execute on function public.world_list_models(boolean) to authenticated;
grant execute on function public.world_list_models(boolean) to service_role;
