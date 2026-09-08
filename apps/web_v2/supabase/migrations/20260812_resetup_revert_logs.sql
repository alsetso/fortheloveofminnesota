-- Resetup revert log — JSON snapshot of wiped game data before a resetup.
-- Allows devs / testers to replay or inspect what a fresh onboarding run looked
-- like, and provides a safety net for accidental resets (revert_log keeps all
-- wiped rows for manual recovery if ever needed).

CREATE TABLE IF NOT EXISTS public.resetup_revert_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  uuid        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now() NOT NULL,
  -- Full JSON dump of every row wiped: xp_transactions, level_state,
  -- territory_presence, world_collections, world_sessions.
  snapshot    jsonb       NOT NULL
);

-- Accounts can read their own revert logs (for future self-service revert UI).
ALTER TABLE public.resetup_revert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account: read own revert logs"
  ON public.resetup_revert_logs
  FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE  public.resetup_revert_logs IS
  'Pre-resetup data snapshots. One row per resetup action. Used for onboarding regression testing and manual data recovery.';
COMMENT ON COLUMN public.resetup_revert_logs.snapshot IS
  'jsonb dump of all rows deleted during resetup: xp_transactions, account_level_state, account_territory_presence, world_collections, account_world_sessions.';
