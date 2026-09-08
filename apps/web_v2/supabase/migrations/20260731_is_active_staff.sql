-- Place AI access: staff (admin.staff) or accounts.role = admin.
-- Security definer so API routes can check staff without exposing admin.staff via PostgREST.

create or replace function public.is_active_staff(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from admin.staff
    where account_id = p_account_id
      and status = 'active'
    limit 1
  );
$$;

revoke all on function public.is_active_staff(uuid) from public;
grant execute on function public.is_active_staff(uuid) to service_role;
grant execute on function public.is_active_staff(uuid) to authenticated;

comment on function public.is_active_staff(uuid) is
  'True when the account has an active admin.staff row. Used for Place AI / privileged tooling.';
