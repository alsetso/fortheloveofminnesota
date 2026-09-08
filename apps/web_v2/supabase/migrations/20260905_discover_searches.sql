-- Discover omnibox search history (completed searches only).
-- Persist on result open or explicit submit — never on keystroke debounce.

create table if not exists public.discover_searches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  query text not null
    check (char_length(btrim(query)) between 2 and 120),
  completed_via text not null
    check (completed_via in ('result_open', 'submit')),
  hit_kind text
    check (
      hit_kind is null
      or hit_kind in (
        'page',
        'territory',
        'atlas_feature',
        'atlas_collection',
        'place',
        'experience_zone',
        'school',
        'post',
        'account'
      )
    ),
  hit_id text,
  hit_title text,
  hit_href text,
  created_at timestamptz not null default now(),
  constraint discover_searches_result_open_has_hit
    check (
      completed_via <> 'result_open'
      or (hit_kind is not null and hit_id is not null)
    )
);

comment on table public.discover_searches is
  'Completed Discover omnibox searches. One row per result open or Enter submit.';

comment on column public.discover_searches.hit_href is
  'Destination route at completion (e.g. /page/slug, /game for map focus).';

create index if not exists discover_searches_account_created
  on public.discover_searches (account_id, created_at desc);

alter table public.discover_searches enable row level security;

drop policy if exists discover_searches_select_own on public.discover_searches;
create policy discover_searches_select_own on public.discover_searches
  for select to authenticated
  using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

drop policy if exists discover_searches_insert_own on public.discover_searches;
create policy discover_searches_insert_own on public.discover_searches
  for insert to authenticated
  with check (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

drop policy if exists discover_searches_delete_own on public.discover_searches;
create policy discover_searches_delete_own on public.discover_searches
  for delete to authenticated
  using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

grant select, insert, delete on public.discover_searches to authenticated;
grant all on public.discover_searches to service_role;
