-- Profile header name mode: show full name or username publicly.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS profile_name_display text NOT NULL DEFAULT 'full_name';

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_profile_name_display_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_profile_name_display_check
  CHECK (profile_name_display IN ('full_name', 'username'));

COMMENT ON COLUMN public.accounts.profile_name_display IS
  'Public profile header label: full_name (default) or username.';
