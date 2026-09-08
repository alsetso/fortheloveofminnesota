-- List visible world placements via public RPC (world schema is not API-exposed).
create or replace function public.world_list_placements(
  p_slugs text[] default null
)
returns table (
  id uuid,
  model_id uuid,
  lat numeric,
  lng numeric,
  slug text,
  scale_multiplier numeric,
  rotation_z numeric
)
language sql
stable
security invoker
set search_path = public, world
as $$
  select
    p.id,
    p.model_id,
    p.lat,
    p.lng,
    m.slug,
    p.scale_multiplier,
    p.rotation_z
  from world.world_placements p
  join world.world_models m on m.id = p.model_id
  where p.visible is true
    and m.active is true
    and (p_slugs is null or m.slug = any (p_slugs));
$$;

revoke all on function public.world_list_placements(text[]) from public;
grant execute on function public.world_list_placements(text[]) to anon;
grant execute on function public.world_list_placements(text[]) to authenticated;
grant execute on function public.world_list_placements(text[]) to service_role;
