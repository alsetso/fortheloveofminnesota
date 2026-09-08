-- List world models for the map picker (world schema is not API-exposed).
create or replace function public.world_list_models(
  p_active_only boolean default false
)
returns table (
  id uuid,
  slug text,
  name text,
  file_path text,
  category text,
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
