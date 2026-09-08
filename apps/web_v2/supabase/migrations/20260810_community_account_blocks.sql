-- Account blocks for Apple 5.1.2(i) — blocker cannot see blocked user's pins / interact.

CREATE TABLE IF NOT EXISTS community.account_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  blocked_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_blocks_not_self CHECK (blocker_account_id <> blocked_account_id),
  CONSTRAINT account_blocks_pair_uidx UNIQUE (blocker_account_id, blocked_account_id)
);

CREATE INDEX IF NOT EXISTS account_blocks_blocker_idx
  ON community.account_blocks (blocker_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_blocks_blocked_idx
  ON community.account_blocks (blocked_account_id);

ALTER TABLE community.account_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_blocks_select_own
  ON community.account_blocks
  FOR SELECT
  TO authenticated
  USING (
    blocker_account_id IN (
      SELECT id FROM public.accounts WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY account_blocks_insert_own
  ON community.account_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    blocker_account_id IN (
      SELECT id FROM public.accounts WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY account_blocks_delete_own
  ON community.account_blocks
  FOR DELETE
  TO authenticated
  USING (
    blocker_account_id IN (
      SELECT id FROM public.accounts WHERE user_id = (SELECT auth.uid())
    )
  );

GRANT USAGE ON SCHEMA community TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE community.account_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.account_blocks TO service_role;

COMMENT ON TABLE community.account_blocks IS
  'User blocks. Blocker cannot see blocked account pins/content in map feeds.';
