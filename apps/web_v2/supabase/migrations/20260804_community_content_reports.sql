-- User-submitted content reports (posts/pins). No withdraw — insert-only for reporters.

CREATE TABLE IF NOT EXISTS community.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'community_post',
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_reason_check
    CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'not_relevant', 'other')),
  CONSTRAINT content_reports_status_check
    CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  CONSTRAINT content_reports_entity_type_check
    CHECK (entity_type IN ('community_post')),
  CONSTRAINT content_reports_details_len_check
    CHECK (details IS NULL OR char_length(details) <= 500)
);

-- One report per reporter per entity (cannot re-report / withdraw).
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_reporter_entity_uidx
  ON community.content_reports (reporter_account_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS content_reports_entity_idx
  ON community.content_reports (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON community.content_reports (status, created_at DESC)
  WHERE status = 'open';

ALTER TABLE community.content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can create their own rows only.
CREATE POLICY "Users can create their own content reports"
  ON community.content_reports
  FOR INSERT
  WITH CHECK (
    reporter_account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

-- Reporters can see their own reports (powers "Reported" UI). No delete/update for users.
CREATE POLICY "Users can read their own content reports"
  ON community.content_reports
  FOR SELECT
  USING (
    reporter_account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

GRANT USAGE ON SCHEMA community TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE community.content_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.content_reports TO service_role;

COMMENT ON TABLE community.content_reports IS
  'User reports on community content. Insert-only for reporters; no withdraw.';
