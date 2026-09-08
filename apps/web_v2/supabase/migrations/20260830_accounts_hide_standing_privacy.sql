-- Profile standing privacy (mirror hide_followers / hide_following).
-- When true, only the account owner sees level / streak / discovers on their profile.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS hide_level boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_streak boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_discovers boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounts.hide_level IS
  'When true, only the owner sees account level on their public profile.';
COMMENT ON COLUMN public.accounts.hide_streak IS
  'When true, only the owner sees login streak on their public profile.';
COMMENT ON COLUMN public.accounts.hide_discovers IS
  'When true, only the owner sees items found / collectibles progress on their public profile.';
