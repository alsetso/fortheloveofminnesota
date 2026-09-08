-- Fix post_media public read after posts flatten (parent_post_id removed).
-- community.post_is_publicly_readable already takes (visibility, is_active, archived),
-- but post_id_is_publicly_readable still selected parent_post_id and called the old 4-arg shape.
-- That made SELECT on post_media fail for anon/authenticated → feed media_url always null.

create or replace function community.post_id_is_publicly_readable(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'community', 'public'
as $function$
  select community.post_is_publicly_readable(
    p.visibility,
    p.is_active,
    p.archived
  )
  from community.posts p
  where p.id = p_post_id;
$function$;

comment on function community.post_id_is_publicly_readable(uuid) is
  'True when the post is public, active, and not archived. Used by post_media / related RLS.';

revoke all on function community.post_id_is_publicly_readable(uuid) from public;
grant execute on function community.post_id_is_publicly_readable(uuid) to anon, authenticated, service_role;
