-- Answer mode on usage events (fast | standard | deep).
alter table ai.ai_usage_events
  add column if not exists mode text;

create index if not exists ai_usage_events_account_mode_idx
  on ai.ai_usage_events (account_id, mode);

comment on column ai.ai_usage_events.mode is
  'User-facing answer mode: fast | standard | deep';
