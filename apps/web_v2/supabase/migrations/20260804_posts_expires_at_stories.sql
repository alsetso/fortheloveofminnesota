-- Stories expire after 24h; expired rows are archived (restorable).
alter table community.posts
  add column if not exists expires_at timestamptz;

comment on column community.posts.expires_at is
  'When set (stories), the post should leave live surfaces after this time and be archived.';

create index if not exists posts_expires_at_live_idx
  on community.posts (expires_at)
  where expires_at is not null and archived = false and is_active = true;

create index if not exists posts_content_shape_idx
  on community.posts (content_shape)
  where content_shape = 'story';
