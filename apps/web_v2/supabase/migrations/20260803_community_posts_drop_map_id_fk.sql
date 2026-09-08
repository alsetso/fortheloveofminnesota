-- Detach community.posts from legacy custom maps (map.maps).
-- iOS community map uses community.posts only; map_id is unused.

ALTER TABLE community.posts
  DROP CONSTRAINT IF EXISTS posts_map_id_fkey;

ALTER TABLE community.posts
  ALTER COLUMN map_id DROP NOT NULL;

UPDATE community.posts
SET map_id = NULL
WHERE map_id IS NOT NULL;
