-- Saved directory pages per account (Save to book → Contacts → Businesses).
-- Restores page.page_favorites after 20260824_drop_page_fluff.

create table if not exists page.page_favorites (
  account_id uuid not null references public.accounts(id) on delete cascade,
  page_id uuid not null references page.pages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, page_id)
);

create index if not exists idx_page_favorites_account_id
  on page.page_favorites (account_id);
create index if not exists idx_page_favorites_page_id
  on page.page_favorites (page_id);

comment on table page.page_favorites is
  'Saved directory pages per account (Save to book → Contacts Businesses).';

alter table page.page_favorites enable row level security;

drop policy if exists "Users can manage own page favorites" on page.page_favorites;
create policy "Users can manage own page favorites"
  on page.page_favorites
  for all
  to authenticated
  using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  )
  with check (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );

grant select, insert, delete on page.page_favorites to authenticated;
grant select on page.page_favorites to anon;
grant all on page.page_favorites to service_role;
