-- ============================================================================
-- world_post_placements join table + auto_placement_for_post trigger.
--
-- Every community pin post (kind='pin', lat IS NOT NULL) automatically gets
-- a world placement whose overrides JSONB carries the parent postId so the
-- iOS tap handler can open PostDetailCard without a separate lookup.
-- ============================================================================

-- ── 1. Join table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world.world_post_placements (
  post_id      UUID PRIMARY KEY REFERENCES community.posts(id) ON DELETE CASCADE,
  placement_id UUID NOT NULL REFERENCES world.world_placements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS world_post_placements_placement_idx
  ON world.world_post_placements (placement_id);

COMMENT ON TABLE world.world_post_placements IS
  'One-to-one join from a community parent post to its auto-created world placement.';

GRANT SELECT ON world.world_post_placements TO anon, authenticated, service_role;
GRANT ALL    ON world.world_post_placements TO service_role;

ALTER TABLE world.world_post_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wppl_select_all ON world.world_post_placements;
CREATE POLICY wppl_select_all
  ON world.world_post_placements
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── 2. auto_placement_for_post() ──────────────────────────────────────────────
-- Fires AFTER INSERT on community.posts WHERE kind = 'pin' AND lat IS NOT NULL.
-- Maps mention_type_id (stable UUIDs) to community-* model slugs.
-- Silent on unknown mention_type_id — post INSERT still succeeds.

CREATE OR REPLACE FUNCTION public.auto_placement_for_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'community'
AS $$
DECLARE
  v_slug        text;
  v_model_id    uuid;
  v_placement_id uuid;
  v_parent_id   uuid;
BEGIN
  -- Only process geo-pinned posts
  IF NEW.kind <> 'pin' THEN
    RETURN NEW;
  END IF;
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map mention_type UUID to community model slug
  v_slug := CASE NEW.mention_type_id::text
    WHEN '11111111-0000-0000-0000-000000000001' THEN 'community-report'
    WHEN '11111111-0000-0000-0000-000000000002' THEN 'community-highlight'
    WHEN '11111111-0000-0000-0000-000000000003' THEN 'community-event'
    WHEN '11111111-0000-0000-0000-000000000004' THEN 'community-story'
    WHEN '11111111-0000-0000-0000-000000000005' THEN 'community-idea'
    ELSE NULL
  END;

  IF v_slug IS NULL THEN
    RAISE LOG 'auto_placement_for_post: unknown mention_type_id % on post %', NEW.mention_type_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve model id
  SELECT id INTO v_model_id FROM world.world_models WHERE slug = v_slug AND active IS TRUE LIMIT 1;
  IF v_model_id IS NULL THEN
    RAISE LOG 'auto_placement_for_post: model slug % not found or inactive', v_slug;
    RETURN NEW;
  END IF;

  -- Determine the parent post id (for overrides.postId tap linkage)
  v_parent_id := COALESCE(NEW.parent_post_id, NEW.id);

  -- Insert world placement
  INSERT INTO world.world_placements (
    model_id,
    placed_by_user_id,
    lat,
    lng,
    location,
    placement_intent,
    visible,
    overrides
  )
  VALUES (
    v_model_id,
    auth.uid(),
    NEW.lat,
    NEW.lng,
    ST_SetSRID(ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision), 4326)::geography,
    'community_post',
    true,
    jsonb_build_object('postId', v_parent_id)
  )
  RETURNING id INTO v_placement_id;

  -- Tag placement to experience zone if post was zone-scoped
  IF NEW.experience_zone_id IS NOT NULL THEN
    INSERT INTO world.world_placement_experience_zones (placement_id, zone_id)
    VALUES (v_placement_id, NEW.experience_zone_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Record the post → placement join
  INSERT INTO world.world_post_placements (post_id, placement_id)
  VALUES (v_parent_id, v_placement_id)
  ON CONFLICT (post_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the post insert
  RAISE LOG 'auto_placement_for_post error (post %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_placement_for_post() TO service_role;

COMMENT ON FUNCTION public.auto_placement_for_post() IS
  'AFTER INSERT trigger on community.posts (kind=pin). Maps mention_type_id to community-* world model, creates a placement, tags to experience_zone, and records the post→placement join. Errors are logged and suppressed — post inserts always succeed.';

DROP TRIGGER IF EXISTS trg_auto_placement_for_post ON community.posts;
CREATE TRIGGER trg_auto_placement_for_post
  AFTER INSERT ON community.posts
  FOR EACH ROW
  WHEN (NEW.kind = 'pin' AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL)
  EXECUTE FUNCTION public.auto_placement_for_post();
