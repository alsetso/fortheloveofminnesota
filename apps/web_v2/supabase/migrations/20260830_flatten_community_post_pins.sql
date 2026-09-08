-- Flatten community posts: one row per contribution.
-- Keep parent (kind=post) rows; delete child pins; drop parent_post_id.
-- Rewrite RLS / triggers that depended on the parent column.

-- 1) Drop child-visibility machinery (depends on parent_post_id)
DROP TRIGGER IF EXISTS trg_enforce_child_post_visibility ON community.posts;
DROP TRIGGER IF EXISTS trg_cascade_post_visibility_to_children ON community.posts;
DROP FUNCTION IF EXISTS community.enforce_child_post_visibility();
DROP FUNCTION IF EXISTS community.cascade_post_visibility_to_children();

-- 2) Simplify public-read helper (no parent walk)
DROP POLICY IF EXISTS cp_public_read ON community.posts;
DROP FUNCTION IF EXISTS community.post_is_publicly_readable(text, boolean, boolean, uuid);

CREATE OR REPLACE FUNCTION community.post_is_publicly_readable(
  p_visibility text,
  p_is_active boolean,
  p_archived boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'community', 'public'
AS $$
  SELECT
    p_visibility IS NOT DISTINCT FROM 'public'
    AND COALESCE(p_is_active, false) = true
    AND COALESCE(p_archived, false) = false;
$$;

CREATE POLICY cp_public_read
  ON community.posts
  FOR SELECT
  TO anon, authenticated
  USING (community.post_is_publicly_readable(visibility, is_active, archived));

-- 3) Publisher insert: drop child-pin branch
DROP POLICY IF EXISTS cp_city_publisher_staff_insert ON community.posts;
CREATE POLICY cp_city_publisher_staff_insert
  ON community.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (published_as = 'page'::text)
    AND (actor_account_id IS NOT NULL)
    AND community.staff_can_manage_city_publisher_posts(actor_account_id, account_id)
  );

DROP FUNCTION IF EXISTS community.staff_can_insert_city_publisher_child_pin(uuid, uuid, uuid);

-- 4) Delete map pin children
DELETE FROM community.posts WHERE kind = 'pin';

-- 5) Drop self-FK column
ALTER TABLE community.posts DROP COLUMN IF EXISTS parent_post_id;

-- 6) Placement trigger: geo community posts (kind=post with lat/lng)
CREATE OR REPLACE FUNCTION public.auto_placement_for_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'community'
AS $$
DECLARE
  v_slug         text;
  v_model_id     uuid;
  v_placement_id uuid;
BEGIN
  IF NEW.kind <> 'post' THEN
    RETURN NEW;
  END IF;
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RETURN NEW;
  END IF;

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

  SELECT id INTO v_model_id FROM world.world_models WHERE slug = v_slug AND active IS TRUE LIMIT 1;
  IF v_model_id IS NULL THEN
    RAISE LOG 'auto_placement_for_post: model slug % not found or inactive', v_slug;
    RETURN NEW;
  END IF;

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
    jsonb_build_object('postId', NEW.id)
  )
  RETURNING id INTO v_placement_id;

  IF NEW.experience_zone_id IS NOT NULL THEN
    INSERT INTO world.world_placement_experience_zones (placement_id, zone_id)
    VALUES (v_placement_id, NEW.experience_zone_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO world.world_post_placements (post_id, placement_id)
  VALUES (NEW.id, v_placement_id)
  ON CONFLICT (post_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'auto_placement_for_post error (post %): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_placement_for_post() IS
  'AFTER INSERT on community.posts (kind=post with lat/lng). Creates world placement + join. Errors suppressed.';

DROP TRIGGER IF EXISTS trg_auto_placement_for_post ON community.posts;
CREATE TRIGGER trg_auto_placement_for_post
  AFTER INSERT ON community.posts
  FOR EACH ROW
  WHEN (NEW.kind = 'post' AND NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL)
  EXECUTE FUNCTION public.auto_placement_for_post();
