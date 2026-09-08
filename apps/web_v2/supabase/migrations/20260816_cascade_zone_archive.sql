-- ============================================================================
-- cascade_zone_archive trigger
--
-- When world.experience_zones.status transitions away from 'active', this
-- trigger archives all community posts contributed to that zone and hides
-- their world placements from the game map.
--
-- Uses `archived = true` (existing boolean) on community.posts.
-- Uses `visible = false` on world.world_placements via the join tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cascade_zone_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'world', 'community'
AS $$
BEGIN
  -- Only fire when status transitions away from 'active'
  IF OLD.status = 'active' AND NEW.status <> 'active' THEN

    -- Archive all community posts pinned to this zone
    UPDATE community.posts
    SET
      archived   = true,
      updated_at = now()
    WHERE experience_zone_id = OLD.id
      AND archived IS NOT TRUE;

    -- Hide all world placements tagged to this zone
    UPDATE world.world_placements wp
    SET    visible = false
    FROM   world.world_placement_experience_zones ez
    WHERE  ez.placement_id = wp.id
      AND  ez.zone_id = OLD.id
      AND  wp.visible IS TRUE;

  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'cascade_zone_archive error (zone %): %', OLD.id, SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cascade_zone_archive() TO service_role;

COMMENT ON FUNCTION public.cascade_zone_archive() IS
  'AFTER UPDATE trigger on world.experience_zones. When status changes from active, archives all community posts and hides all world placements associated with that zone in a single transaction.';

DROP TRIGGER IF EXISTS trg_cascade_zone_archive ON world.experience_zones;
CREATE TRIGGER trg_cascade_zone_archive
  AFTER UPDATE OF status ON world.experience_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_zone_archive();
