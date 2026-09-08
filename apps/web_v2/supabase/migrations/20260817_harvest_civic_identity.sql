-- Harvest civic identity off page.pages + local_gov onto government accounts.
-- Mint unclaimed publishers only for CTUs/counties that have unique copy.
-- Losers go to confirm.proposals (kind=harvest_stash). No row deletes.
-- Rollback:
--   DELETE FROM confirm.proposals WHERE kind = 'harvest_stash' AND note LIKE 'harvest:20260817%';
--   DELETE FROM territory.officeholders WHERE source_urls @> ARRAY['local_gov.officials'];
--   DELETE FROM territory.seats s USING territory.units u
--     WHERE s.unit_id = u.id AND u.slug IN ('apple-valley-dakota','brooklyn-park-hennepin')
--       AND u.subtype = 'CITY';
--   UPDATE territory.units SET owner_account_id = NULL
--     WHERE owner_account_id IN (SELECT id FROM public.accounts WHERE guest_id LIKE '%-publisher:%'
--       AND id NOT IN (SELECT publisher_account_id FROM admin.territories WHERE publisher_account_id IS NOT NULL));
--   DELETE FROM public.accounts WHERE guest_id LIKE 'county-publisher:%'
--     OR (guest_id LIKE 'city-publisher:%' AND id NOT IN (
--       SELECT publisher_account_id FROM admin.territories WHERE publisher_account_id IS NOT NULL));

-- ─── columns ─────────────────────────────────────────────────────────────────
alter table public.accounts
  add column if not exists website_url text;

alter table public.accounts
  add column if not exists about text;

alter table public.accounts
  add column if not exists office_hours text;

comment on column public.accounts.website_url is
  'Org website. Person accounts keep this null; government/business use it as Contact.';

comment on column public.accounts.about is
  'Long-form About. Distinct from bio (≤220 tagline).';

comment on column public.accounts.office_hours is
  'Published office hours (not council cadence — that stays on territory.units).';

alter table confirm.proposals drop constraint if exists proposals_kind_check;

alter table confirm.proposals
  add constraint proposals_kind_check
  check (kind = any (array['tip', 'field_flag', 'meeting_flag', 'harvest_stash']::text[]));

-- ─── harvest helpers (dropped at end of this file) ───────────────────────────
create or replace function public._civic_is_boilerplate(p text)
returns boolean
language sql
immutable
as $$
  select p is null
    or length(trim(p)) = 0
    or p ~ 'Explore local community, boundaries, and civic information'
    or lower(trim(p)) in ('test', 'updates from the city page.');
$$;

create or replace function public._civic_is_garbage_url(p text)
returns boolean
language sql
immutable
as $$
  select p is not null and (
    p ~* 'google\.com/maps'
    or p ~* 'utm_source=openai'
  );
$$;

create or replace function public._civic_norm_url(p text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(p);
begin
  if v is null or v = '' or public._civic_is_garbage_url(v) then
    return null;
  end if;
  if v ~* '^https?://' then
    return v;
  end if;
  return 'https://' || v;
end;
$$;

create or replace function public._civic_is_office_hours(p text)
returns boolean
language sql
immutable
as $$
  select p is not null and p ~* '(monday|mon).{0,12}(friday|fri)';
$$;

create or replace function public._civic_looks_like_cadence(p text)
returns boolean
language sql
immutable
as $$
  select p is not null and (
    p ~* '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
    or p ~* '(1st|2nd|3rd|4th|first|second|third|fourth|every)'
  );
$$;

create or replace function public._civic_is_bad_hall(p text)
returns boolean
language sql
immutable
as $$
  select p is not null and (
    p ~ 'MN 5124'
    or p ~* 'swcd'
    or lower(trim(p)) in ('city hall', 'city hall.')
  );
$$;

create or replace function public._civic_harvest_stash(
  p_subject uuid,
  p_unit uuid,
  p_submitter uuid,
  p_field text,
  p_source text,
  p_value jsonb,
  p_extra text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_value is null or p_value = 'null'::jsonb or p_value = '""'::jsonb then
    return;
  end if;
  if exists (
    select 1
    from confirm.proposals pr
    where pr.kind = 'harvest_stash'
      and pr.unit_id = p_unit
      and pr.field_key = p_field
      and pr.note like 'harvest:20260817%'
      and pr.proposed_value is not distinct from p_value
  ) then
    return;
  end if;

  insert into confirm.proposals (
    subject_account_id,
    unit_id,
    kind,
    target_table,
    target_id,
    field_key,
    proposed_value,
    note,
    submitted_by_account_id,
    status
  ) values (
    p_subject,
    p_unit,
    'harvest_stash',
    p_source,
    p_unit,
    p_field,
    p_value,
    'harvest:20260817' || coalesce(' ' || p_extra, ''),
    p_submitter,
    'rejected'
  );
end;
$$;

do $$
declare
  v_submitter uuid;
  r record;
  v_guest text;
  v_username text;
  v_account uuid;
  v_about text;
  v_bio text;
  v_web text;
  v_phone text;
  v_email text;
  v_hall text;
  v_hall_name text;
  v_schedule text;
  v_hours text;
  v_icon text;
  v_cover text;
  v_src text;
  v_n int;
  v_city_slugs text[] := array[
    'anoka-anoka',
    'apple-valley-dakota',
    'big-lake-sherburne',
    'brooklyn-park-hennepin',
    'minneapolis-hennepin',
    'orono-hennepin',
    'dayton-hennepin',
    'mound-hennepin',
    'otsego-wright',
    'plymouth-hennepin',
    'saint-louis-park-hennepin',
    'saint-michael-wright',
    'saint-paul-ramsey',
    'waconia-carver',
    'bloomington-hennepin',
    'duluth-saint-louis',
    'maple-grove-hennepin',
    'rochester-olmsted',
    'saint-cloud-stearns',
    'woodbury-washington'
  ];
  v_county_slugs text[] := array[
    'carver', 'hennepin', 'meeker', 'stearns', 'wright', 'sherburne', 'beltrami'
  ];
begin
  select id into v_submitter
  from public.accounts
  where username = 'cole'
  limit 1;

  if v_submitter is null then
    select id into v_submitter
    from public.accounts
    where username = 'fortheloveofminnesota'
    limit 1;
  end if;

  if v_submitter is null then
    raise exception 'harvest needs a submitter account (cole or fortheloveofminnesota)';
  end if;

  select count(*) into v_n
  from territory.units u
  where (u.kind = 'ctu' and u.subtype = 'CITY' and u.slug = any (v_city_slugs))
     or (u.kind = 'county' and u.slug = any (v_county_slugs));

  if v_n <> 27 then
    raise exception 'harvest target count % <> 27 (CITY slug + county slug mismatch)', v_n;
  end if;

  for r in
    select
      u.id as unit_id,
      u.kind,
      u.name,
      u.slug,
      u.subtype,
      u.owner_account_id,
      u.description as unit_desc,
      u.website_url as unit_web,
      u.contact_phone as unit_phone,
      u.contact_email as unit_email,
      u.hall_address as unit_hall,
      u.hall_name as unit_hall_name,
      u.meeting_schedule_label as unit_schedule,
      p.id as page_id,
      p.description as page_desc,
      p.website as page_web,
      p.phone as page_phone,
      p.email as page_email,
      p.address_line as page_addr,
      p.icon as page_icon,
      p.cover_url as page_cover,
      p.owner_id as page_owner,
      pr.overview as lg_overview,
      pr.hall_address as lg_hall,
      pr.hall_name as lg_hall_name,
      pr.phone as lg_phone,
      pr.email as lg_email,
      pr.external_site_url as lg_web,
      pr.meeting_time as lg_time,
      pr.meeting_schedule as lg_schedule,
      cpp.hall_address as cpp_hall,
      cpp.meeting_time as cpp_time,
      cpp.meeting_schedule as cpp_schedule
    from territory.units u
    left join page.pages p on p.id = u.page_id
    left join local_gov.records rec on rec.city_id = u.id
    left join local_gov.profiles pr on pr.record_id = rec.id
    left join community.civic_page_profiles cpp on cpp.directory_page_id = u.page_id
    where (u.kind = 'ctu' and u.subtype = 'CITY' and u.slug = any (v_city_slugs))
       or (u.kind = 'county' and u.slug = any (v_county_slugs))
  loop
    if r.kind = 'county' then
      v_guest := 'county-publisher:' || r.unit_id::text;
      v_username := 'county-' || r.slug;
    else
      v_guest := 'city-publisher:' || r.unit_id::text;
      v_username := 'city-' || r.slug;
    end if;

    select a.id into v_account
    from public.accounts a
    where a.guest_id = v_guest
    limit 1;

    if v_account is null and r.owner_account_id is not null then
      v_account := r.owner_account_id;
    end if;

    if v_account is null then
      if exists (select 1 from public.accounts a where a.username = v_username) then
        v_username := v_username || '-' || substr(r.unit_id::text, 1, 8);
      end if;

      insert into public.accounts (
        username,
        guest_id,
        first_name,
        last_name,
        account_type,
        claim_status,
        role,
        plan,
        billing_mode,
        onboarded,
        status
      ) values (
        v_username,
        v_guest,
        r.name,
        case when r.kind = 'county' then 'County' else 'City' end,
        'government',
        'unclaimed',
        'general',
        'hobby',
        'standard',
        true,
        'active'
      )
      returning id into v_account;
    end if;

    update public.accounts
    set
      account_type = 'government',
      claim_status = coalesce(claim_status, 'unclaimed')
    where id = v_account
      and (account_type is distinct from 'government' or claim_status is null);

    update territory.units
    set owner_account_id = v_account
    where id = r.unit_id
      and owner_account_id is distinct from v_account;

    -- ── about (longest non-boilerplate) ──────────────────────────────────────
    v_about := null;
    v_src := null;
    if not public._civic_is_boilerplate(r.lg_overview)
       and (v_about is null or length(r.lg_overview) > length(v_about)) then
      v_about := r.lg_overview;
      v_src := 'local_gov.profiles.overview';
    end if;
    if not public._civic_is_boilerplate(r.page_desc)
       and length(coalesce(r.page_desc, '')) > 80
       and (v_about is null or length(r.page_desc) > length(v_about)) then
      v_about := r.page_desc;
      v_src := 'page.pages.description';
    end if;
    if not public._civic_is_boilerplate(r.unit_desc)
       and (v_about is null or length(r.unit_desc) > length(v_about)) then
      v_about := r.unit_desc;
      v_src := 'territory.units.description';
    end if;

    -- short page copy is a tagline, not about (Orono "The Lakeshore City")
    v_bio := null;
    if not public._civic_is_boilerplate(r.page_desc)
       and length(trim(r.page_desc)) > 0
       and length(trim(r.page_desc)) <= 80 then
      v_bio := trim(r.page_desc);
    end if;

    if v_about is not null then
      update public.accounts a
      set about = v_about
      where a.id = v_account
        and a.about is null;

      if r.unit_desc is null then
        update territory.units
        set description = v_about
        where id = r.unit_id
          and description is null;
      elsif r.unit_desc is distinct from v_about
            and not public._civic_is_boilerplate(r.unit_desc) then
        perform public._civic_harvest_stash(
          v_account, r.unit_id, v_submitter, 'about',
          'territory.units.description', to_jsonb(r.unit_desc), 'loser'
        );
      end if;

      if r.lg_overview is distinct from v_about
         and not public._civic_is_boilerplate(r.lg_overview) then
        perform public._civic_harvest_stash(
          v_account, r.unit_id, v_submitter, 'about',
          'local_gov.profiles.overview', to_jsonb(r.lg_overview), 'loser'
        );
      end if;
      if r.page_desc is distinct from v_about
         and r.page_desc is distinct from v_bio
         and not public._civic_is_boilerplate(r.page_desc)
         and length(coalesce(r.page_desc, '')) > 80 then
        perform public._civic_harvest_stash(
          v_account, r.unit_id, v_submitter, 'about',
          'page.pages.description', to_jsonb(r.page_desc), 'loser'
        );
      end if;
    elsif not public._civic_is_boilerplate(r.page_desc)
          and length(coalesce(r.page_desc, '')) > 80 then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'about',
        'page.pages.description', to_jsonb(r.page_desc), 'skipped-boilerplate-or-empty-winner'
      );
    end if;

    if v_bio is not null then
      update public.accounts a
      set bio = v_bio
      where a.id = v_account
        and a.bio is null;

      if exists (
        select 1 from public.accounts a
        where a.id = v_account
          and a.bio is distinct from v_bio
      ) then
        perform public._civic_harvest_stash(
          v_account, r.unit_id, v_submitter, 'bio',
          'page.pages.description', to_jsonb(v_bio), 'tagline-not-applied'
        );
      end if;
    end if;

    if r.page_desc is not null
       and public._civic_is_boilerplate(r.page_desc) then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'about',
        'page.pages.description', to_jsonb(r.page_desc), 'boilerplate-skipped'
      );
    end if;

    -- ── website ──────────────────────────────────────────────────────────────
    v_web := coalesce(
      public._civic_norm_url(r.page_web),
      public._civic_norm_url(r.lg_web),
      public._civic_norm_url(r.unit_web)
    );

    if public._civic_is_garbage_url(r.unit_web) then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'website_url',
        'territory.units.website_url', to_jsonb(r.unit_web), 'garbage'
      );
    end if;

    if v_web is not null then
      update public.accounts a
      set website_url = v_web
      where a.id = v_account
        and a.website_url is null;

      update territory.units u
      set website_url = v_web
      where u.id = r.unit_id
        and (u.website_url is null or public._civic_is_garbage_url(u.website_url));
    end if;

    -- ── phone / email ────────────────────────────────────────────────────────
    v_phone := coalesce(nullif(trim(r.lg_phone), ''), nullif(trim(r.page_phone), ''), nullif(trim(r.unit_phone), ''));
    v_email := coalesce(nullif(trim(r.lg_email), ''), nullif(trim(r.page_email), ''), nullif(trim(r.unit_email), ''));

    if v_phone is not null then
      update public.accounts a
      set phone = v_phone
      where a.id = v_account
        and a.phone is null;
      update territory.units
      set contact_phone = v_phone
      where id = r.unit_id
        and contact_phone is null;
    end if;

    if v_email is not null then
      update public.accounts a
      set email = v_email
      where a.id = v_account
        and a.email is null;
      update territory.units
      set contact_email = v_email
      where id = r.unit_id
        and contact_email is null;
    end if;

    -- ── hall (units only) ────────────────────────────────────────────────────
    v_hall := null;
    v_hall_name := r.unit_hall_name;
    if not public._civic_is_bad_hall(r.lg_hall) and coalesce(r.lg_hall, '') <> '' then
      v_hall := r.lg_hall;
    elsif not public._civic_is_bad_hall(r.page_addr) and coalesce(r.page_addr, '') <> '' then
      v_hall := r.page_addr;
    elsif not public._civic_is_bad_hall(r.cpp_hall) and coalesce(r.cpp_hall, '') <> '' then
      v_hall := r.cpp_hall;
    elsif not public._civic_is_bad_hall(r.unit_hall) then
      v_hall := r.unit_hall;
    end if;

    if r.lg_hall_name is not null and v_hall_name is null then
      v_hall_name := r.lg_hall_name;
    end if;

    if v_hall is not null then
      update territory.units
      set hall_address = v_hall
      where id = r.unit_id
        and hall_address is null;
    end if;
    if v_hall_name is not null then
      update territory.units
      set hall_name = v_hall_name
      where id = r.unit_id
        and hall_name is null;
    end if;

    if public._civic_is_bad_hall(r.lg_hall) then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'hall_address',
        'local_gov.profiles.hall_address', to_jsonb(r.lg_hall), 'bad-hall'
      );
    end if;
    if public._civic_is_bad_hall(r.cpp_hall) then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'hall_address',
        'community.civic_page_profiles.hall_address', to_jsonb(r.cpp_hall), 'bad-hall'
      );
    end if;

    -- ── schedule vs office hours ─────────────────────────────────────────────
    v_hours := null;
    v_schedule := r.unit_schedule;

    if public._civic_is_office_hours(r.lg_time) then
      v_hours := r.lg_time;
    end if;

    if public._civic_looks_like_cadence(r.lg_schedule) then
      v_schedule := trim(both from concat_ws(
        ' · ',
        r.lg_schedule,
        case when public._civic_is_office_hours(r.lg_time) then null else r.lg_time end
      ));
    elsif public._civic_looks_like_cadence(r.cpp_schedule ->> 'label') then
      v_schedule := trim(both from concat_ws(
        ' · ',
        r.cpp_schedule ->> 'label',
        r.cpp_time
      ));
    elsif r.lg_schedule is not null
          and not public._civic_looks_like_cadence(r.lg_schedule) then
      perform public._civic_harvest_stash(
        v_account, r.unit_id, v_submitter, 'meeting_schedule',
        'local_gov.profiles.meeting_schedule', to_jsonb(r.lg_schedule), 'not-cadence'
      );
    end if;

    if v_hours is not null then
      update public.accounts a
      set office_hours = v_hours
      where a.id = v_account
        and a.office_hours is null;
    end if;

    if v_schedule is not null then
      update territory.units
      set meeting_schedule_label = v_schedule
      where id = r.unit_id
        and meeting_schedule_label is null;
    end if;

    -- ── avatar / cover from page ─────────────────────────────────────────────
    v_icon := nullif(trim(r.page_icon), '');
    v_cover := nullif(trim(r.page_cover), '');
    if v_icon is not null then
      update public.accounts a
      set image_url = v_icon
      where a.id = v_account
        and a.image_url is null;
    end if;
    if v_cover is not null then
      update public.accounts a
      set cover_image_url = v_cover
      where a.id = v_account
        and a.cover_image_url is null;
    end if;
  end loop;

  -- ── staff can act as new unclaimed publishers (same as Phase 0) ────────────
  insert into public.account_members (org_account_id, person_account_id)
  select u.owner_account_id, s.account_id
  from territory.units u
  cross join admin.staff s
  where u.owner_account_id is not null
    and s.status = 'active'
    and s.account_id is not null
    and (
      (u.kind = 'ctu' and u.subtype = 'CITY' and u.slug = any (v_city_slugs))
      or (u.kind = 'county' and u.slug = any (v_county_slugs))
    )
  on conflict do nothing;

  -- ── Apple Valley + Brooklyn Park officials → seats ─────────────────────────
  insert into territory.seats (
    unit_id, seat_type, title, sub_label, is_elected, is_active
  )
  select
    rec.city_id,
    case
      when o.title ~* 'mayor' then 'mayor'
      when o.title ~* 'administrator' then 'city_administrator'
      when o.title ~* 'council' then 'council_member'
      else left(regexp_replace(lower(o.title), '[^a-z0-9]+', '_', 'g'), 40)
    end,
    o.title,
    case
      when o.title ~* 'mayor' then null
      when o.title ~* 'administrator' then null
      else o.name
    end,
    o.title !~* 'administrator',
    true
  from local_gov.officials o
  join local_gov.records rec on rec.id = o.record_id
  join territory.units u on u.id = rec.city_id
  where u.slug in ('apple-valley-dakota', 'brooklyn-park-hennepin')
    and u.subtype = 'CITY'
    and coalesce(o.is_current, true)
  on conflict on constraint seats_unit_id_seat_type_sub_label_key do nothing;

  insert into territory.officeholders (
    seat_id, full_name, email, phone, is_current, source_urls
  )
  select
    s.id,
    o.name,
    o.email,
    o.phone,
    true,
    array['local_gov.officials']
  from local_gov.officials o
  join local_gov.records rec on rec.id = o.record_id
  join territory.units u on u.id = rec.city_id
  join territory.seats s
    on s.unit_id = rec.city_id
   and s.seat_type = case
      when o.title ~* 'mayor' then 'mayor'
      when o.title ~* 'administrator' then 'city_administrator'
      when o.title ~* 'council' then 'council_member'
      else left(regexp_replace(lower(o.title), '[^a-z0-9]+', '_', 'g'), 40)
    end
   and s.sub_label is not distinct from case
      when o.title ~* 'mayor' then null
      when o.title ~* 'administrator' then null
      else o.name
    end
  where u.slug in ('apple-valley-dakota', 'brooklyn-park-hennepin')
    and u.subtype = 'CITY'
    and coalesce(o.is_current, true)
    and not exists (
      select 1 from territory.officeholders oh
      where oh.seat_id = s.id and oh.is_current
    );

  -- ── stash Orono scrape debris as one blob ──────────────────────────────────
  insert into confirm.proposals (
    subject_account_id, unit_id, kind, target_table, field_key,
    proposed_value, note, submitted_by_account_id, status
  )
  select
    u.owner_account_id,
    u.id,
    'harvest_stash',
    'local_gov.services',
    'services',
    jsonb_agg(jsonb_build_object('title', s.title, 'category', s.category, 'url', s.url) order by s.sort_order),
    'harvest:20260817 civicplus-nav-not-services',
    v_submitter,
    'rejected'
  from local_gov.services s
  join local_gov.records rec on rec.id = s.record_id
  join territory.units u on u.id = rec.city_id
  where u.slug = 'orono-hennepin'
    and u.subtype = 'CITY'
    and not exists (
      select 1 from confirm.proposals pr
      where pr.kind = 'harvest_stash'
        and pr.unit_id = u.id
        and pr.field_key = 'services'
        and pr.note like 'harvest:20260817%'
    )
  group by u.owner_account_id, u.id;
end $$;

drop function if exists public._civic_harvest_stash(uuid, uuid, uuid, text, text, jsonb, text);
drop function if exists public._civic_is_bad_hall(text);
drop function if exists public._civic_looks_like_cadence(text);
drop function if exists public._civic_is_office_hours(text);
drop function if exists public._civic_norm_url(text);
drop function if exists public._civic_is_garbage_url(text);
drop function if exists public._civic_is_boilerplate(text);
