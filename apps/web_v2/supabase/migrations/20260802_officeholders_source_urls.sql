-- Persist research citations used when enriching / filling officeholders.
alter table territory.officeholders
  add column if not exists source_urls text[] not null default '{}'::text[];

comment on column territory.officeholders.source_urls is
  'Citation URLs used when researching / enriching this officeholder.';
