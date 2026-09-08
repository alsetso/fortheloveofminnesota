-- Per-territory living knowledge. One summary per official source URL.
-- Archive stays in dot_gov; this is the AI overlay keyed to territory.units.

create table if not exists ai.unit_knowledge (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references territory.units(id) on delete cascade,
  source_url text not null,
  title text not null,
  category text not null default 'other',
  summary text not null,
  snapshot_id uuid,
  openai_response_id text,
  model text,
  status text not null default 'ready'
    check (status in ('ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, source_url)
);

create index if not exists idx_unit_knowledge_unit_updated
  on ai.unit_knowledge (unit_id, updated_at desc);

comment on table ai.unit_knowledge is
  'AI summaries of official .gov pages, one row per (unit, source_url). Refresh in place.';

alter table ai.unit_knowledge enable row level security;

drop policy if exists unit_knowledge_public_read on ai.unit_knowledge;
create policy unit_knowledge_public_read on ai.unit_knowledge
  for select
  using (true);

grant select on ai.unit_knowledge to anon, authenticated;
grant all on ai.unit_knowledge to service_role;
