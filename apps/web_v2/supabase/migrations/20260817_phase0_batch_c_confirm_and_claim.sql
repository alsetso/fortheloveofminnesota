-- Phase 0 Batch C (0.12–0.13): confirm.proposals + approve_government_claim.
-- is_app_admin() already exists. Rollback: drop function + drop schema confirm cascade.

create schema if not exists confirm;

create table if not exists confirm.proposals (
  id uuid primary key default gen_random_uuid(),
  subject_account_id uuid references public.accounts(id) on delete set null,
  unit_id uuid references territory.units(id) on delete set null,
  kind text not null
    check (kind in ('tip', 'field_flag', 'meeting_flag')),
  target_table text,
  target_id uuid,
  field_key text,
  proposed_value jsonb,
  note text,
  submitted_by_account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  reviewed_by_account_id uuid references public.accounts(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    subject_account_id is not null
    or unit_id is not null
    or target_id is not null
  )
);

create index if not exists idx_confirm_proposals_subject_status
  on confirm.proposals (subject_account_id, status, created_at desc);

create index if not exists idx_confirm_proposals_submitter
  on confirm.proposals (submitted_by_account_id, created_at desc);

comment on table confirm.proposals is
  'Resident tips/flags against an account or unit. Provenance overlay — not a visibility gate.';

alter table confirm.proposals enable row level security;

drop policy if exists confirm_proposals_insert_own on confirm.proposals;
create policy confirm_proposals_insert_own on confirm.proposals
  for insert to authenticated
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = submitted_by_account_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists confirm_proposals_select on confirm.proposals;
create policy confirm_proposals_select on confirm.proposals
  for select to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = submitted_by_account_id
        and a.user_id = auth.uid()
    )
    or (
      subject_account_id is not null
      and public.is_account_member(subject_account_id)
    )
    or public.is_app_admin()
  );

-- Status updates via service role / future admin API only (no authenticated update policy)

grant usage on schema confirm to authenticated, service_role;
grant select, insert on confirm.proposals to authenticated;
grant all on confirm.proposals to service_role;

-- Notify PostgREST of new schema (safe if already exposed via dashboard)
-- Apps that need confirm should use service role or add confirm to exposed schemas.

create or replace function public.approve_government_claim(
  p_org_account_id uuid,
  p_clerk_person_account_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_org_type text;
  v_clerk_user uuid;
begin
  -- Interactive callers must be app admins; service_role / migration (no jwt) allowed.
  if auth.uid() is not null and not public.is_app_admin() then
    raise exception 'Only app admins can approve government claims';
  end if;

  select account_type into v_org_type
  from public.accounts
  where id = p_org_account_id;

  if v_org_type is distinct from 'government' then
    raise exception 'org account must be account_type = government';
  end if;

  select user_id into v_clerk_user
  from public.accounts
  where id = p_clerk_person_account_id;

  if v_clerk_user is null then
    raise exception 'clerk must be a person account with user_id';
  end if;

  insert into public.account_members (org_account_id, person_account_id)
  values (p_org_account_id, p_clerk_person_account_id)
  on conflict do nothing;

  delete from public.account_members m
  using admin.staff s
  where m.org_account_id = p_org_account_id
    and m.person_account_id = s.account_id
    and m.person_account_id is distinct from p_clerk_person_account_id;

  update public.accounts
  set
    claim_status = 'claimed',
    claimed_at = now(),
    claimed_by_account_id = p_clerk_person_account_id
  where id = p_org_account_id;
end;
$$;

revoke all on function public.approve_government_claim(uuid, uuid) from public;
grant execute on function public.approve_government_claim(uuid, uuid) to authenticated;
grant execute on function public.approve_government_claim(uuid, uuid) to service_role;

comment on function public.approve_government_claim(uuid, uuid) is
  'Atomic claim: add clerk member, remove staff members, set claim_status = claimed.';
