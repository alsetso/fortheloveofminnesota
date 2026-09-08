-- Legal acceptance: add ip_address + user_agent for legal defensibility
-- Applied: 2026-08-13
-- Industry standard: Stripe, Airbnb, GitHub all record IP + UA at consent time.

alter table public.account_policy_acceptances
  add column if not exists ip_address inet,
  add column if not exists user_agent text;

comment on column public.account_policy_acceptances.ip_address is
  'Client IP at time of acceptance. Required for legal defensibility.';
comment on column public.account_policy_acceptances.user_agent is
  'Browser/device user-agent string at time of acceptance.';

-- Updated RPC: now accepts p_ip_address + p_user_agent
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

  if v_method = 'reconsent' then
    update public.accounts
    set
      terms_version_id = v_terms.id,
      privacy_version_id = v_privacy.id,
      terms_accepted_at = v_now,
      privacy_accepted_at = v_now,
      updated_at = v_now
    where id = p_account_id;
  else
    update public.accounts
    set
      terms_version_id = coalesce(terms_version_id, v_terms.id),
      privacy_version_id = coalesce(privacy_version_id, v_privacy.id),
      terms_accepted_at = coalesce(terms_accepted_at, v_now),
      privacy_accepted_at = coalesce(privacy_accepted_at, v_now),
      updated_at = v_now
    where id = p_account_id;
  end if;

  return jsonb_build_object(
    'account_id', p_account_id,
    'platform', v_source,
    'method', v_method,
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
