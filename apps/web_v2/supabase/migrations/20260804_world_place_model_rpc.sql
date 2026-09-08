-- Authenticated drop helper — builds geography POINT and returns joined row.
create or replace function public.world_place_model(
  p_slug text,
  p_lng double precision,
  p_lat double precision,
  p_account_id uuid default null,
  p_placed_by_name text default '',
  p_scale_multiplier numeric default 1,
  p_rotation_z numeric default 0
)
returns table (
  id uuid,
  model_id uuid,
  lat numeric,
  lng numeric,
  slug text,
  file_path text,
  scale_multiplier numeric,
  rotation_z numeric
)
language plpgsql
security invoker
set search_path = public, world, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_model uuid;
  v_placement_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select m.id into v_model
  from world.world_models m
  where m.slug = p_slug and m.active is true
  limit 1;

  if v_model is null then
    raise exception 'Unknown or inactive model slug: %', p_slug;
  end if;

  insert into world.world_placements (
    model_id,
    placed_by_user_id,
    placed_by_account_id,
    placed_by_name,
    location,
    scale_multiplier,
    rotation_z
  ) values (
    v_model,
    v_user,
    p_account_id,
    coalesce(p_placed_by_name, ''),
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    coalesce(p_scale_multiplier, 1),
    coalesce(p_rotation_z, 0)
  )
  returning world.world_placements.id into v_placement_id;

  return query
  select
    p.id,
    p.model_id,
    p.lat,
    p.lng,
    m.slug,
    m.file_path,
    p.scale_multiplier,
    p.rotation_z
  from world.world_placements p
  join world.world_models m on m.id = p.model_id
  where p.id = v_placement_id;
end;
$$;

revoke all on function public.world_place_model(text, double precision, double precision, uuid, text, numeric, numeric) from public;
grant execute on function public.world_place_model(text, double precision, double precision, uuid, text, numeric, numeric) to authenticated;
grant execute on function public.world_place_model(text, double precision, double precision, uuid, text, numeric, numeric) to service_role;
