-- Legal compliance lock-in
-- 1) Correct July 31 backfill timestamps to real account signup dates
-- 2) signup = first soft agreement at account creation; reconsent = later versions
-- 3) Never overwrite accepted_at; auto-bind new accounts via trigger

-- ---------------------------------------------------------------------------
-- 1. Factual backfill
--    accepted_at was stamped 2026-07-31 when the legal tables were seeded.
--    Real first agreement = accounts.created_at (OTP/signup).
--    created_at on the log row is left as-is (when the record was written).
--    source ios2 was incorrect — these accounts were created on web.
-- ---------------------------------------------------------------------------
update public.account_policy_acceptances apa
set
  accepted_at = a.created_at,
  source = 'web',
  acceptance_method = 'signup'
from public.accounts a
where a.id = apa.account_id
  and apa.acceptance_method = 'signup';

update public.accounts
set
  terms_accepted_at = created_at,
  privacy_accepted_at = created_at
where terms_accepted_at is distinct from created_at
   or privacy_accepted_at is distinct from created_at;

-- Bind any account that somehow missed the log (none expected; safety)
insert into public.account_policy_acceptances (
  account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source
)
select
  a.id,
  v.policy_id,
  v.id,
  a.created_at,
  'signup',
  'web'
from public.accounts a
cross join lateral (
  select * from public.legal_current_version('terms_of_service', 'web') limit 1
) v
where not exists (
  select 1 from public.account_policy_acceptances x
  where x.account_id = a.id and x.policy_id = v.policy_id
)
  and v.id is not null;

insert into public.account_policy_acceptances (
  account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source
)
select
  a.id,
  v.policy_id,
  v.id,
  a.created_at,
  'signup',
  'web'
from public.accounts a
cross join lateral (
  select * from public.legal_current_version('privacy_policy', 'web') limit 1
) v
where not exists (
  select 1 from public.account_policy_acceptances x
  where x.account_id = a.id and x.policy_id = v.policy_id
)
  and v.id is not null;

-- ---------------------------------------------------------------------------
-- 2. RPC: signup is first-bind only; reconsent advances versions
-- ---------------------------------------------------------------------------
create or replace function public.accept_current_legal_policies(
  p_account_id uuid,
  p_platform text default 'ios2',
  p_method text default 'signup',
  p_ip_address inet default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms public.legal_policy_versions;
  v_privacy public.legal_policy_versions;
  v_now timestamptz := now();
  v_source text := coalesce(nullif(p_platform, ''), 'ios2');
  v_method text := coalesce(nullif(p_method, ''), 'signup');
  v_existing_terms uuid;
  v_existing_privacy uuid;
  v_stale boolean := false;
begin
  if v_method not in ('signup', 'reconsent', 'notice') then
    raise exception 'invalid acceptance_method: %', v_method;
  end if;

  if not exists (select 1 from public.accounts a where a.id = p_account_id) then
    raise exception 'account not found';
  end if;

  select * into v_terms from public.legal_current_version('terms_of_service', v_source) limit 1;
  select * into v_privacy from public.legal_current_version('privacy_policy', v_source) limit 1;

  if v_terms.id is null or v_privacy.id is null then
    raise exception 'published legal policies missing for platform %', v_source;
  end if;

  select terms_version_id, privacy_version_id
    into v_existing_terms, v_existing_privacy
  from public.accounts
  where id = p_account_id;

  -- Already bound to an older published version: signup/notice must not silently upgrade.
  if v_method = 'signup'
     and v_existing_terms is not null
     and v_existing_terms is distinct from v_terms.id then
    v_stale := true;
  end if;
  if v_method = 'signup'
     and v_existing_privacy is not null
     and v_existing_privacy is distinct from v_privacy.id then
    v_stale := true;
  end if;

  if v_stale then
    return jsonb_build_object(
      'account_id', p_account_id,
      'platform', v_source,
      'method', v_method,
      'accepted', false,
      'needs_reconsent', true,
      'terms_version_id', v_existing_terms,
      'privacy_version_id', v_existing_privacy,
      'current_terms_version_id', v_terms.id,
      'current_privacy_version_id', v_privacy.id
    );
  end if;

  if v_method = 'signup' then
    -- First bind only. Conflict keeps original accepted_at.
    insert into public.account_policy_acceptances (
      account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source,
      ip_address, user_agent
    ) values
      (p_account_id, v_terms.policy_id, v_terms.id, v_now, 'signup', v_source,
       p_ip_address, p_user_agent),
      (p_account_id, v_privacy.policy_id, v_privacy.id, v_now, 'signup', v_source,
       p_ip_address, p_user_agent)
    on conflict (account_id, policy_version_id) do update set
      ip_address = coalesce(account_policy_acceptances.ip_address, excluded.ip_address),
      user_agent = coalesce(account_policy_acceptances.user_agent, excluded.user_agent);

    update public.accounts
    set
      terms_version_id = coalesce(terms_version_id, v_terms.id),
      privacy_version_id = coalesce(privacy_version_id, v_privacy.id),
      terms_accepted_at = coalesce(terms_accepted_at, v_now),
      privacy_accepted_at = coalesce(privacy_accepted_at, v_now),
      updated_at = v_now
    where id = p_account_id;
  else
    -- reconsent | notice — new version rows, new timestamps
    insert into public.account_policy_acceptances (
      account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source,
      ip_address, user_agent
    ) values
      (p_account_id, v_terms.policy_id, v_terms.id, v_now, v_method, v_source,
       p_ip_address, p_user_agent),
      (p_account_id, v_privacy.policy_id, v_privacy.id, v_now, v_method, v_source,
       p_ip_address, p_user_agent)
    on conflict (account_id, policy_version_id) do update set
      ip_address = coalesce(account_policy_acceptances.ip_address, excluded.ip_address),
      user_agent = coalesce(account_policy_acceptances.user_agent, excluded.user_agent);

    update public.accounts
    set
      terms_version_id = v_terms.id,
      privacy_version_id = v_privacy.id,
      terms_accepted_at = v_now,
      privacy_accepted_at = v_now,
      updated_at = v_now
    where id = p_account_id;
  end if;

  return jsonb_build_object(
    'account_id', p_account_id,
    'platform', v_source,
    'method', v_method,
    'accepted', true,
    'needs_reconsent', false,
    'accepted_at', v_now,
    'terms_version_id', v_terms.id,
    'privacy_version_id', v_privacy.id,
    'terms_version_label', v_terms.version_label,
    'privacy_version_label', v_privacy.version_label,
    'terms_platform', v_terms.platform,
    'privacy_platform', v_privacy.platform
  );
end;
$$;

revoke all on function public.accept_current_legal_policies(uuid, text, text, inet, text) from public;
grant execute on function public.accept_current_legal_policies(uuid, text, text, inet, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Trigger: every new account gets a signup acceptance at created_at
-- ---------------------------------------------------------------------------
create or replace function public.trg_account_legal_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms public.legal_policy_versions;
  v_privacy public.legal_policy_versions;
begin
  select * into v_terms from public.legal_current_version('terms_of_service', 'all') limit 1;
  select * into v_privacy from public.legal_current_version('privacy_policy', 'all') limit 1;

  if v_terms.id is null or v_privacy.id is null then
    return new;
  end if;

  insert into public.account_policy_acceptances (
    account_id, policy_id, policy_version_id, accepted_at, acceptance_method, source
  ) values
    (new.id, v_terms.policy_id, v_terms.id, new.created_at, 'signup', 'web'),
    (new.id, v_privacy.policy_id, v_privacy.id, new.created_at, 'signup', 'web')
  on conflict (account_id, policy_version_id) do nothing;

  update public.accounts
  set
    terms_version_id = coalesce(terms_version_id, v_terms.id),
    privacy_version_id = coalesce(privacy_version_id, v_privacy.id),
    terms_accepted_at = coalesce(terms_accepted_at, new.created_at),
    privacy_accepted_at = coalesce(privacy_accepted_at, new.created_at)
  where id = new.id
    and (terms_version_id is null or privacy_version_id is null);

  return new;
end;
$$;

drop trigger if exists trg_account_legal_signup on public.accounts;
create trigger trg_account_legal_signup
  after insert on public.accounts
  for each row
  execute function public.trg_account_legal_signup();

comment on function public.trg_account_legal_signup() is
  'First soft agreement: bind new accounts to current published Terms + Privacy at created_at.';
