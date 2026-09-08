DROP FUNCTION IF EXISTS public.world_list_models(boolean);

CREATE FUNCTION public.world_list_models(p_active_only boolean DEFAULT false)
RETURNS TABLE(
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
  default_height_meters numeric,
  allow_user_scale boolean,
  interaction text,
  on_collect text,
  reward jsonb,
  rare boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'world'
AS $function$
  select
    m.id, m.slug, m.name, m.file_path, m.category,
    coalesce((
      select array_agg(t.slug order by t.sort_order, t.slug)
      from world.world_model_taggings mt
      join world.world_model_tags t on t.id = mt.tag_id
      where mt.model_id = m.id and t.active is true
    ), '{}'::text[]) as tags,
    m.active, m.sort_order, m.real_world_meters, m.native_units_max,
    m.default_rotation_z, m.default_height_meters, m.allow_user_scale,
    m.interaction, m.on_collect, m.reward, m.rare
  from world.world_models m
  where (not p_active_only) or m.active is true
  order by m.active desc, m.sort_order nulls last, m.name;
$function$;

REVOKE ALL ON FUNCTION public.world_list_models(boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.world_list_models(boolean) TO service_role;
