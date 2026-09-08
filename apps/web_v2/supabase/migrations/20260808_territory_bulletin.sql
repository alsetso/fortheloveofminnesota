-- Territory Bulletin Board — iOS Supabase project migration
-- Extends community.posts with territory_bulletin content shape, territory anchor columns,
-- and youtube media type. iOS DB includes 'story' in the content_shape CHECK.

-- ─── 1. Extend content_shape CHECK (iOS: standard | pin_group | story | territory_bulletin) ───
ALTER TABLE community.posts
  DROP CONSTRAINT IF EXISTS community_posts_content_shape_check;

ALTER TABLE community.posts
  ADD CONSTRAINT community_posts_content_shape_check
  CHECK (content_shape IN ('standard', 'pin_group', 'story', 'territory_bulletin'));

COMMENT ON COLUMN community.posts.content_shape IS
  'standard = regular post/pin; pin_group = ordered multi-stop list; '
  'story = 24h expiring story; territory_bulletin = civic entity public resource feed post';

-- ─── 2. Add territory_kind + territory_unit_id columns ───────────────────────
ALTER TABLE community.posts
  ADD COLUMN IF NOT EXISTS territory_kind TEXT
  CHECK (territory_kind IN ('city', 'town', 'county', 'school_district'));

ALTER TABLE community.posts
  ADD COLUMN IF NOT EXISTS territory_unit_id UUID;

COMMENT ON COLUMN community.posts.territory_kind IS
  'For content_shape=territory_bulletin: display label for the civic entity type.';

COMMENT ON COLUMN community.posts.territory_unit_id IS
  'For content_shape=territory_bulletin: FK to territory.units.id. '
  'Aligns with account_territory_presence.unit_id and dock entity.id.';

ALTER TABLE community.posts
  DROP CONSTRAINT IF EXISTS community_posts_bulletin_requires_territory;

ALTER TABLE community.posts
  ADD CONSTRAINT community_posts_bulletin_requires_territory
  CHECK (
    content_shape <> 'territory_bulletin'
    OR (territory_kind IS NOT NULL AND territory_unit_id IS NOT NULL)
  );

-- ─── 3. Extend post_media.media_type CHECK to include 'youtube' ───────────────
ALTER TABLE community.post_media
  DROP CONSTRAINT IF EXISTS community_post_media_media_type_check;

ALTER TABLE community.post_media
  ADD CONSTRAINT community_post_media_media_type_check
  CHECK (media_type IN ('image', 'video', 'audio', 'document', 'youtube'));

COMMENT ON COLUMN community.post_media.media_type IS
  'image | video | audio | document | youtube. '
  'For youtube: url = full YouTube video URL; meta = {video_id, thumbnail, title, channel_name?, duration_iso?}';

-- ─── 4. Performance indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cp_territory_bulletin_unit
  ON community.posts (territory_unit_id, created_at DESC)
  WHERE content_shape = 'territory_bulletin'
    AND territory_unit_id IS NOT NULL
    AND is_active = true
    AND archived = false;

CREATE INDEX IF NOT EXISTS idx_cp_territory_kind
  ON community.posts (territory_kind, created_at DESC)
  WHERE content_shape = 'territory_bulletin'
    AND is_active = true
    AND archived = false;

-- ─── 5. RLS — territory_bulletin read gate ────────────────────────────────────
-- Bulletin posts (territory_bulletin) are only readable by accounts that have
-- visited the territory. Standard posts remain governed by existing visibility policies.
-- The application layer (territory-bulletin API route) enforces this check first;
-- this RLS policy is a secondary defense.

-- Allow SELECT on territory_bulletin posts when the viewer has a presence record
-- for the same territory unit. Non-bulletin posts use the existing public visibility policy.
DO $$
BEGIN
  -- Only add if RLS is already enabled on community.posts (it should be from the base schema).
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'posts' AND n.nspname = 'community' AND c.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS territory_bulletin_read ON community.posts;
    EXECUTE $pol$
      CREATE POLICY territory_bulletin_read ON community.posts
        FOR SELECT
        USING (
          content_shape <> 'territory_bulletin'
          OR (
            territory_unit_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.account_territory_presence atp
              WHERE atp.unit_id = territory_unit_id
                AND atp.account_id = (
                  SELECT id FROM public.accounts
                  WHERE auth_user_id = auth.uid()
                  LIMIT 1
                )
            )
          )
        );
    $pol$;

    DROP POLICY IF EXISTS territory_bulletin_insert ON community.posts;
    EXECUTE $pol$
      CREATE POLICY territory_bulletin_insert ON community.posts
        FOR INSERT
        WITH CHECK (
          content_shape <> 'territory_bulletin'
          OR (
            territory_unit_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.account_territory_presence atp
              WHERE atp.unit_id = territory_unit_id
                AND atp.account_id = (
                  SELECT id FROM public.accounts
                  WHERE auth_user_id = auth.uid()
                  LIMIT 1
                )
            )
          )
        );
    $pol$;
  END IF;
END;
$$;

-- ─── 6. Seed a dedicated "Bulletin" post type ──────────────────────────────────
INSERT INTO community.post_types (emoji, name, is_active)
VALUES ('📋', 'Bulletin', true)
ON CONFLICT DO NOTHING;
