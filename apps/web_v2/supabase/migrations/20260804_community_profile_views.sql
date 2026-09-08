-- community.profile_views — per-viewer log for profile opens (mirrors post_views).
-- Bumps public.accounts.view_count via trigger (skips self-views).

CREATE TABLE IF NOT EXISTS community.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  viewer_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'profile_card'
);

CREATE INDEX IF NOT EXISTS profile_views_profile_viewed_at_idx
  ON community.profile_views (profile_account_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS profile_views_viewer_idx
  ON community.profile_views (viewer_account_id)
  WHERE viewer_account_id IS NOT NULL;

ALTER TABLE community.profile_views ENABLE ROW LEVEL SECURITY;

-- Anyone can log a view; viewer_account_id must be null or owned by auth.uid().
CREATE POLICY "Anyone can log a profile view"
  ON community.profile_views
  FOR INSERT
  WITH CHECK (
    viewer_account_id IS NULL
    OR viewer_account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

-- Profile owners can read views on their profile.
CREATE POLICY "Owners can view their profile views"
  ON community.profile_views
  FOR SELECT
  USING (
    profile_account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

-- Viewers can see their own rows.
CREATE POLICY "Viewers can see their own profile view rows"
  ON community.profile_views
  FOR SELECT
  USING (
    viewer_account_id IN (
      SELECT accounts.id FROM public.accounts WHERE accounts.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION community.increment_profile_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'community', 'public'
AS $$
BEGIN
  -- Never count (or credit) self-views.
  IF NEW.viewer_account_id IS NOT DISTINCT FROM NEW.profile_account_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.accounts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = NEW.profile_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_views_inc_count ON community.profile_views;
CREATE TRIGGER trg_profile_views_inc_count
  AFTER INSERT ON community.profile_views
  FOR EACH ROW
  EXECUTE FUNCTION community.increment_profile_view_count();

GRANT USAGE ON SCHEMA community TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE community.profile_views TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE community.profile_views TO service_role;

COMMENT ON TABLE community.profile_views IS
  'Per-open profile view log — powers Contributor "who viewed my profile" feed.';
