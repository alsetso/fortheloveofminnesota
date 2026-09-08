-- Account demo steps tracking.
-- account_demo_steps stores how many of the 5 interactive tutorial steps the
-- user has completed (0 = none, 5 = all). Gate in SetupGate prevents access
-- to /game until this reaches 5.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_demo_steps int4 NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.accounts.account_demo_steps IS
  'Number of interactive map demo steps completed (0–5). Gate releases at 5.';
