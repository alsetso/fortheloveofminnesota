-- R2-backed media drafts / Recents. Written only on explicit commit
-- (Save Draft, Send, Post) — never on capture. Separate from post_media
-- because not every draft becomes a published post.

CREATE TABLE IF NOT EXISTS community.media_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_key text NOT NULL,
  media_type text NOT NULL,
  post_id uuid NULL REFERENCES community.posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_drafts_media_type_check
    CHECK (media_type IN ('image', 'video')),
  CONSTRAINT media_drafts_url_https_check
    CHECK (url LIKE 'https://%'),
  CONSTRAINT media_drafts_storage_key_len_check
    CHECK (char_length(storage_key) BETWEEN 1 AND 512)
);

-- Idempotent commit: same R2 object for an account → one draft row.
CREATE UNIQUE INDEX IF NOT EXISTS media_drafts_account_storage_key_uidx
  ON community.media_drafts (account_id, storage_key);

CREATE INDEX IF NOT EXISTS media_drafts_account_created_idx
  ON community.media_drafts (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_drafts_post_id_idx
  ON community.media_drafts (post_id)
  WHERE post_id IS NOT NULL;

ALTER TABLE community.media_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their media drafts"
  ON community.media_drafts
  FOR SELECT
  USING (
    account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can insert their media drafts"
  ON community.media_drafts
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can update their media drafts"
  ON community.media_drafts
  FOR UPDATE
  USING (
    account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can delete their media drafts"
  ON community.media_drafts
  FOR DELETE
  USING (
    account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

GRANT USAGE ON SCHEMA community TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.media_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.media_drafts TO service_role;

COMMENT ON TABLE community.media_drafts IS
  'R2-backed Recents / media drafts. Created on Save Draft, Send, or Post — not on capture.';
